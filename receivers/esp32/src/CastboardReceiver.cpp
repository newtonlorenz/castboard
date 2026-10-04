#include "CastboardReceiver.h"
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <esp_heap_caps.h>
#include <memory>

namespace {
uint8_t* allocate(size_t size) {
  auto* p=static_cast<uint8_t*>(heap_caps_malloc(size, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  return p ? p : static_cast<uint8_t*>(malloc(size));
}
// HTTPClient removes chunked-transfer framing before writing to this bounded
// sink. A bad response cannot grow allocations past the declared frame budget.
class BufferStream : public Stream {
 public:
  uint8_t* data; size_t size=0,capacity; bool overflow=false;
  explicit BufferStream(size_t cap):data(allocate(cap+1)),capacity(cap){}
  ~BufferStream(){free(data);}
  int available() override{return 0;} int read() override{return -1;} int peek() override{return -1;} void flush() override{}
  size_t write(uint8_t value) override{return write(&value,1);}
  size_t write(const uint8_t* source,size_t length) override {
    if(!data || length>capacity-size){overflow=true;return 0;}
    memcpy(data+size,source,length);size+=length;data[size]=0;return length;
  }
};
lv_color_t color(JsonVariantConst value, const char* fallback) {
  const char* text=value.is<const char*>()?value.as<const char*>():fallback;
  char rgb[7]{};strncpy(rgb,text[0]=='#'?text+1:text,6);
  return lv_color_hex(strtoul(rgb,nullptr,16));
}
const lv_font_t* font(int size) {
#if LV_FONT_MONTSERRAT_32
  if(size>=28)return &lv_font_montserrat_32;
#endif
#if LV_FONT_MONTSERRAT_20
  if(size>=19)return &lv_font_montserrat_20;
#endif
  return LV_FONT_DEFAULT;
}
lv_obj_t* label(lv_obj_t* parent,const char* text,int size=14) {
  auto* item=lv_label_create(parent);lv_label_set_text(item,text?text:"");
  lv_obj_set_width(item,lv_pct(100));lv_label_set_long_mode(item,LV_LABEL_LONG_WRAP);
  lv_obj_set_style_text_font(item,font(size),0);return item;
}
}

bool CastboardReceiver::begin(lv_obj_t* parent) {
  if(task_ || !settings_.server || !settings_.deviceId || !settings_.connectionKey)return false;
  const String server(settings_.server);
  if(!server.startsWith("http://") && !server.startsWith("https://"))return false;
  if(server.startsWith("https://") && !settings_.rootCA)return false;
  parent_=parent?parent:castboard_lvgl::screen();
  canvas_=lv_obj_create(parent_);lv_obj_remove_style_all(canvas_);lv_obj_set_size(canvas_,lv_pct(100),lv_pct(100));
  statusLabel_=lv_label_create(parent_);lv_label_set_text(statusLabel_,"Connecting to Castboard...");
  lv_obj_align(statusLabel_,LV_ALIGN_BOTTOM_MID,0,-4);lv_obj_set_style_bg_opa(statusLabel_,LV_OPA_90,0);lv_obj_set_style_bg_color(statusLabel_,lv_color_hex(0x14201e),0);lv_obj_set_style_text_color(statusLabel_,lv_color_white(),0);lv_obj_set_style_pad_all(statusLabel_,4,0);
  events_=xQueueCreate(4,sizeof(Event));results_=xQueueCreate(1,sizeof(Result*));
  if(!events_ || !results_)return false;
  return xTaskCreate(networkTask,"castboard-net",12288,this,1,&task_)==pdPASS;
}
void CastboardReceiver::networkTask(void* self){static_cast<CastboardReceiver*>(self)->network();}
void CastboardReceiver::network() {
  String base(settings_.server);while(base.endsWith("/"))base.remove(base.length()-1);
  base+="/api/devices/";base+=settings_.deviceId;
  String mode="",frameId="";int width=0,height=0;uint32_t interval=5000,lastConfig=0,nextPoll=0;
  auto deliver=[&](Result* result){Result* previous=nullptr;if(xQueueReceive(results_,&previous,0)==pdTRUE){free(previous->bytes);delete previous;}xQueueSend(results_,&result,portMAX_DELAY);};
  auto request=[&](const String& path,const String& body,size_t limit,Result* result)->int {
    std::unique_ptr<WiFiClient> client;
    if(base.startsWith("https://")){auto* tls=new WiFiClientSecure();tls->setCACert(settings_.rootCA);client.reset(tls);}else client.reset(new WiFiClient());
    HTTPClient http;http.setConnectTimeout(3000);http.setTimeout(path=="/frame" || path=="/touch" ? 45000 : 15000);http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
    if(!http.begin(*client,base+path))return -1;
    http.addHeader("Authorization",String("Bearer ")+settings_.connectionKey);
    const char* headers[]={"X-Frame-Id","X-Frame-Width","X-Frame-Height","X-Frame-Format"};http.collectHeaders(headers,4);
    if(path=="/frame" && frameId.length())http.addHeader("If-None-Match",String('"')+frameId+'"');
    int code;
    if(body.length()){http.addHeader("Content-Type","application/json");code=http.POST(body);}else code=http.GET();
    if(code==200){
      BufferStream buffer(limit);
      const int copied=buffer.data?http.writeToStream(&buffer):-1;
      if(copied<0 || buffer.overflow || !buffer.size){http.end();return -2;}
      result->bytes=buffer.data;result->length=buffer.size;buffer.data=nullptr;result->revision=http.header("X-Frame-Id");result->format=http.header("X-Frame-Format");
      if(http.hasHeader("X-Frame-Width"))result->width=http.header("X-Frame-Width").toInt();
      if(http.hasHeader("X-Frame-Height"))result->height=http.header("X-Frame-Height").toInt();
    }
    http.end();return code;
  };
  for(;;){
    if(WiFi.status()!=WL_CONNECTED){connected_=false;frameId="";xQueueReset(events_);auto* result=new Result();result->error="Wi-Fi offline - keeping last view";deliver(result);vTaskDelay(pdMS_TO_TICKS(3000));continue;}
    if(refreshRequested_.exchange(false)) { mode="";frameId="";nextPoll=0; }
    if(mode.isEmpty() || uint32_t(millis()-lastConfig)>60000){
      Result config;const int code=request("/config","",16384,&config);
      JsonDocument doc;
      if(code!=200 || deserializeJson(doc,config.bytes,config.length) || String(doc["protocol"]|"")!="castboard-device/1"){
        free(config.bytes);connected_=false;frameId="";xQueueReset(events_);auto* result=new Result();result->error=code==401?"Connection key rejected":"Server unavailable - keeping last view";deliver(result);vTaskDelay(pdMS_TO_TICKS(5000));continue;
      }
      mode=doc["mode"].as<String>();width=doc["width"]|0;height=doc["height"]|0;interval=doc["refreshMs"]|5000;lastConfig=millis();
      const bool supported=(mode=="native" || (mode=="frame" && String(doc["format"]|"")=="rgb565")) && width>=16 && height>=16 && width<=1920 && height<=1920 && width*height<=1920*1080;
      free(config.bytes);
      if(!supported){mode="";auto* result=new Result();result->error="Choose native mode or RGB565 images in Displays";deliver(result);vTaskDelay(pdMS_TO_TICKS(5000));continue;}
      frameId="";nextPoll=0;
    }
    Event event{};const bool hasEvent=xQueueReceive(events_,&event,pdMS_TO_TICKS(20))==pdTRUE;
    if(!hasEvent && int32_t(millis()-nextPoll)<0)continue;
    if(hasEvent && event.native!=(mode=="native")){nextPoll=0;continue;}
    String body,path=mode=="native"?"/scene":"/frame";
    if(hasEvent){JsonDocument input;input["eventId"]=event.id;
      if(event.native){input["sceneId"]=event.revision;input["event"]=event.control;path="/events";}
      else{input["frameId"]=event.revision;input["x"]=event.x;input["y"]=event.y;path="/touch";}
      serializeJson(input,body);
    }
    auto* result=new Result();result->native=mode=="native";result->width=width;result->height=height;
    const int code=request(path,body,result->native?128*1024:size_t(width)*height*2,result);
    if(code==200 && result->native) {
      JsonDocument scene;
      if(!deserializeJson(scene,result->bytes,result->length) && String(scene["protocol"]|"")=="castboard-scene/1") {
        size_t imageBytes=0;
        for(JsonObjectConst panel:scene["panels"].as<JsonArrayConst>()) {
          if(!panel["image"].is<JsonObjectConst>())continue;
          const auto info=panel["image"];NativeImage image;
          image.index=info["index"].as<String>();image.resourceId=info["resourceId"].as<String>();image.width=info["width"]|0;image.height=info["height"]|0;
          const String path=info["path"]|"",expected=String("/images/")+image.index+"?sceneId="+scene["sceneId"].as<String>();
          const bool indexValid=image.index.length()>0 && image.index.length()<=2 && image.index.toInt()>=0 && image.index==String(image.index.toInt());
          const size_t length=image.width>0 && image.height>0?size_t(image.width)*image.height*2:0;
          if(!indexValid || image.resourceId.length()!=24 || strspn(image.resourceId.c_str(),"0123456789abcdef")!=24 || path!=expected || image.width>width || image.height>height || !length || imageBytes+length>size_t(width)*height*4 || result->images.size()>=4) {result->error="Invalid image resource - keeping last view";break;}
          imageBytes+=length;Result snapshot;
          const int imageCode=request(path,"",length,&snapshot);
          if(imageCode==200 && snapshot.length==length && snapshot.width==image.width && snapshot.height==image.height && snapshot.format=="rgb565") {image.bytes=std::shared_ptr<uint8_t>(snapshot.bytes,free);snapshot.bytes=nullptr;image.length=length;}
          else image.error="Image unavailable - keeping last image";
          free(snapshot.bytes);result->images.push_back(std::move(image));
        }
      }
    }
    if(code==200 && (!result->native && result->length!=size_t(width)*height*2)){free(result->bytes);result->bytes=nullptr;result->error="Incomplete image - keeping last frame";}
    else if(code!=200 && code!=304 && code!=409)result->error=code==401?"Connection key rejected":"Update failed - keeping last view";
    if(code!=200 && code!=304){connected_=false;frameId="";xQueueReset(events_);}
    if(code==200 || code==304)connected_=true;
    if(code==409){nextPoll=0;delete result;continue;}
    if(code==304){delete result;nextPoll=millis()+interval;continue;}
    if(result->revision.length())frameId=result->revision;
    deliver(result);nextPoll=millis()+(code==200?interval:5000);
  }
}
void CastboardReceiver::send(const char* control,int x,int y) {
  if(revision_.isEmpty() || !connected_)return;
  Event event{};event.native=native_;strlcpy(event.control,control?control:"",sizeof(event.control));strlcpy(event.revision,revision_.c_str(),sizeof(event.revision));
  snprintf(event.id,sizeof(event.id),"%08lx-%08lx",static_cast<unsigned long>(esp_random()),static_cast<unsigned long>(millis()));event.x=x;event.y=y;
  // Drop extra rapid taps instead of accumulating delayed actions.
  if(uxQueueMessagesWaiting(events_)==0)xQueueSend(events_,&event,0);
}
void CastboardReceiver::inputEvent(lv_event_t* event) {
  auto* self=static_cast<CastboardReceiver*>(lv_event_get_user_data(event));
  auto* target=static_cast<lv_obj_t*>(lv_event_get_target(event));
  if(lv_event_get_code(event)==LV_EVENT_DELETE){free(lv_obj_get_user_data(target));return;}
  if(lv_event_get_code(event)!=LV_EVENT_CLICKED)return;
  const char* control=static_cast<char*>(lv_obj_get_user_data(target));
  if(control)self->send(control);
  else{lv_point_t point;lv_indev_get_point(castboard_lvgl::input(),&point);self->send("",point.x,point.y);}
}
void CastboardReceiver::display(Result* result) {
  if(result->error.length()){status_=result->error;return;}
  JsonDocument doc;
  if(result->native && (deserializeJson(doc,result->bytes,result->length) || String(doc["protocol"]|"")!="castboard-scene/1")){status_="Invalid scene - keeping last view";return;}
  if(result->width!=castboard_lvgl::width(parent_) || result->height!=castboard_lvgl::height(parent_)){status_="Set display resolution to match the panel in Castboard";return;}
  ++updates_;
  if(result->native && native_ && revision_==doc["sceneId"].as<String>()) {
    status_=doc["message"]|"";
    for(const auto& incoming:result->images) {
      if(!incoming.bytes){status_=incoming.error;continue;}
      for(auto& drawn:nativeImages_)if(drawn->value.index==incoming.index) {
        if(drawn->value.bytes)castboard_lvgl::dropImage(&drawn->descriptor);
        drawn->value=incoming;
        castboard_lvgl::setImage(drawn->descriptor,drawn->value.bytes.get(),drawn->value.length,drawn->value.width,drawn->value.height);
        if(drawn->object)castboard_lvgl::updateImageObject(drawn->object,&drawn->descriptor);
        else {lv_obj_clean(drawn->slot);drawn->object=castboard_lvgl::imageObject(drawn->slot,&drawn->descriptor);}
      }
    }
    return;
  }
  auto previousImages=std::move(nativeImages_);nativeImages_.clear();
  lv_obj_clean(canvas_);for(auto& drawn:previousImages)if(drawn->value.bytes)castboard_lvgl::dropImage(&drawn->descriptor);if(pixels_)castboard_lvgl::dropImage(&image_);free(pixels_);pixels_=nullptr;native_=result->native;
  auto attach=[&](lv_obj_t* obj,const char* control){lv_obj_add_flag(obj,LV_OBJ_FLAG_CLICKABLE);lv_obj_set_user_data(obj,control?strdup(control):nullptr);lv_obj_add_event_cb(obj,inputEvent,LV_EVENT_ALL,this);};
  if(!native_){
    pixels_=result->bytes;result->bytes=nullptr;revision_=result->revision;
    castboard_lvgl::setImage(image_,pixels_,result->length,result->width,result->height);
    auto* img=castboard_lvgl::imageObject(canvas_,&image_);attach(img,nullptr);castboard_lvgl::clearFlag(canvas_,LV_OBJ_FLAG_SCROLLABLE);
  }else{
    revision_=doc["sceneId"].as<String>();status_=doc["message"]|"";lv_obj_add_flag(canvas_,LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_bg_opa(canvas_,LV_OPA_COVER,0);lv_obj_set_style_bg_color(canvas_,color(doc["background"],"#07100f"),0);
    auto button=[&](lv_obj_t* parent,const char* text,const char* event){auto* btn=castboard_lvgl::button(parent);auto* copy=lv_label_create(btn);lv_label_set_text(copy,text);lv_obj_center(copy);lv_obj_set_height(btn,44);attach(btn,event);return btn;};
    if(doc["navigation"].size()){JsonObjectConst nav=doc["navigation"][0];auto* btn=button(canvas_,nav["label"]|"Back",nav["event"]|"back");lv_obj_set_pos(btn,8,2);lv_obj_set_width(btn,100);}
    for(JsonObjectConst panel:doc["panels"].as<JsonArrayConst>()){
      auto* box=lv_obj_create(canvas_);lv_obj_remove_style_all(box);auto bounds=panel["bounds"];auto style=panel["appearance"];
      lv_obj_set_pos(box,bounds["x"]|0,bounds["y"]|0);lv_obj_set_size(box,bounds["width"]|160,bounds["height"]|100);
      lv_obj_set_style_bg_opa(box,LV_OPA_COVER,0);lv_obj_set_style_bg_color(box,color(style["background"],"#14201e"),0);lv_obj_set_style_text_color(box,color(style["textColor"],"#f3faf7"),0);lv_obj_set_style_radius(box,style["radius"]|12,0);lv_obj_set_style_pad_all(box,style["padding"]|12,0);lv_obj_set_style_pad_row(box,6,0);lv_obj_set_flex_flow(box,LV_FLEX_FLOW_COLUMN);
      if(panel["event"].is<const char*>() && String(panel["eventTarget"]|"")=="panel")attach(box,panel["event"]);
      const char* title=panel["title"]|"";if(*title)label(box,title,14);
      if(panel["image"].is<JsonObjectConst>()) {
        auto drawn=std::unique_ptr<DrawnImage>(new DrawnImage());
        drawn->value.index=panel["image"]["index"].as<String>();drawn->value.resourceId=panel["image"]["resourceId"].as<String>();
        drawn->value.width=panel["image"]["width"]|1;drawn->value.height=panel["image"]["height"]|1;
        drawn->slot=lv_obj_create(box);lv_obj_remove_style_all(drawn->slot);castboard_lvgl::clearFlag(drawn->slot,LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_set_size(drawn->slot,drawn->value.width,drawn->value.height);
        for(const auto& incoming:result->images)if(incoming.index==drawn->value.index){drawn->value=incoming;break;}
        if(drawn->value.bytes)castboard_lvgl::setImage(drawn->descriptor,drawn->value.bytes.get(),drawn->value.length,drawn->value.width,drawn->value.height);
        else for(const auto& previous:previousImages)if(castboard_lvgl::retainImage(drawn->descriptor,drawn->value,previous->descriptor,previous->value))break;
        if(drawn->value.bytes)drawn->object=castboard_lvgl::imageObject(drawn->slot,&drawn->descriptor);
        if(drawn->value.error.length())status_=drawn->value.error;
        if(!drawn->object)label(drawn->slot,"Image unavailable",14);
        nativeImages_.push_back(std::move(drawn));
      }
      const int scale=style["fontScale"]|100;
      for(JsonObjectConst item:panel["lines"].as<JsonArrayConst>()){
        const String kind=item["kind"]|"body";auto* text=label(box,item["text"]|"",(kind=="metric"?32:kind=="small"?14:20)*scale/100);
        if(kind=="muted")lv_obj_set_style_text_color(text,color(style["mutedColor"],"#91a49e"),0);
      }
      for(JsonObjectConst control:panel["controls"].as<JsonArrayConst>()){
        auto* btn=button(box,control["label"]|"Action",control["event"]|"");lv_obj_set_width(btn,lv_pct(100));
      }
      if(panel["event"].is<const char*>() && String(panel["eventTarget"]|"")!="panel"){auto* btn=button(box,panel["label"]|"Open",panel["event"]);lv_obj_set_width(btn,lv_pct(100));}
    }
    if(doc["confirmation"].is<JsonObjectConst>()){
      auto* overlay=lv_obj_create(canvas_);lv_obj_set_size(overlay,lv_pct(100),lv_pct(100));lv_obj_set_pos(overlay,0,0);lv_obj_set_flex_flow(overlay,LV_FLEX_FLOW_COLUMN);
      label(overlay,doc["confirmation"]["message"]|"Confirm action",20);
      button(overlay,"Cancel",doc["confirmation"]["cancelEvent"]|"cancel");button(overlay,"Confirm",doc["confirmation"]["confirmEvent"]|"confirm");
    }
  }
  if(!native_)status_="";
}
void CastboardReceiver::loop() {
  if(!results_)return;Result* result=nullptr;
  if(xQueueReceive(results_,&result,0)==pdTRUE){display(result);free(result->bytes);delete result;lv_label_set_text(statusLabel_,status_.c_str());lv_obj_move_foreground(statusLabel_);if(status_.isEmpty())lv_obj_add_flag(statusLabel_,LV_OBJ_FLAG_HIDDEN);else castboard_lvgl::clearFlag(statusLabel_,LV_OBJ_FLAG_HIDDEN);}
}

#include "../src/bounded_body.h"
#include <cassert>
#include <vector>
#include <cstdio>
struct Client {
  uint32_t& now; std::vector<uint8_t> bytes; size_t pos=0;
  bool halfOpen=false, zeroReads=false, trickle=false;
  int available(){return trickle?(now%10000==0?1:0):int(bytes.size()-pos);}
  bool connected(){return halfOpen || trickle || pos<bytes.size();}
  int read(uint8_t* data,size_t size){
    if(zeroReads)return 0;
    if(trickle){*data=1;return 1;}
    const size_t n=std::min(size,bytes.size()-pos);
    std::copy(bytes.begin()+pos,bytes.begin()+pos+n,data);pos+=n;return int(n);
  }
};
struct Sink {std::vector<uint8_t> bytes;size_t write(const uint8_t* p,size_t n){bytes.insert(bytes.end(),p,p+n);return n;}};
int main(){
  for(int scenario=0;scenario<7;scenario++){
    uint32_t now=scenario==6?UINT32_MAX-1000:0; const uint32_t start=now;
    Client client{now,{1,2,3,4}};Sink sink;int length=4;size_t limit=4;
    if(scenario==1){client.bytes={1,2};client.halfOpen=true;}
    if(scenario==2)client.zeroReads=true;
    if(scenario==3){client.trickle=true;length=100;limit=100;}
    if(scenario==4)length=5;
    if(scenario==5)client.bytes={1,2};
    if(scenario==6){client.bytes={};client.halfOpen=true;}
    const bool ok=castboard_http::readBody(client,sink,length,limit,[&]{return now;},[&]{now+=10;});
    assert(ok==(scenario==0));assert(sink.bytes.size()<=limit);
    if(scenario==1 || scenario==2 || scenario==6)assert(uint32_t(now-start)==15000);
    if(scenario==3)assert(uint32_t(now-start)==60000);
  }
  std::puts("7 bounded HTTP body scenarios passed");
}

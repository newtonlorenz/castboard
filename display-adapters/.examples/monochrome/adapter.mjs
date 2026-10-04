// Hardware-independent example: adapt a standard RGB565 frame to a one-bit
// transport. Keep GPIO and panel-bus drivers in the receiver firmware.
export function configure({device}) {
  return {pixelFormat:'mono1',stride:Math.ceil(device.width/8),bitOrder:'msb-first',white:1};
}
export function encodeFrame({data,format,width,height},{options}) {
  if(format!=='rgb565' || data.length!==width*height*2)throw new Error('Expected an RGB565 source image');
  const stride=Math.ceil(width/8),output=Buffer.alloc(stride*height),threshold=options.threshold ?? 128;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const pixel=data.readUInt16LE((y*width+x)*2);
    const red=((pixel>>11)&31)*255/31,green=((pixel>>5)&63)*255/63,blue=(pixel&31)*255/31;
    const white=(red*299+green*587+blue*114)/1000>=threshold;
    if(white!==Boolean(options.invert))output[y*stride+(x>>3)]|=0x80>>(x&7);
  }
  return {data:output,contentType:'application/octet-stream'};
}
// A custom receiver may send this compact input shape. Castboard still checks
// its frame revision, event ID, assigned content and action permissions.
export function decodeInput(bytes) {
  const input=JSON.parse(bytes.toString('utf8'));
  return {eventId:input.sequence,frameId:input.revision,x:input.position?.[0],y:input.position?.[1]};
}

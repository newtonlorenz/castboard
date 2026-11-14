#pragma once
#include <cstddef>
#include <cstdint>
#include <algorithm>

namespace castboard_http {
// HTTP/1.0 requests avoid chunk framing. Keep both an idle deadline and an
// overall deadline: a connected socket is not evidence of transfer progress.
template<class Client, class Sink, class Clock, class Pause>
bool readBody(Client& client, Sink& sink, int length, size_t limit,
              Clock now, Pause pause, uint32_t idleMs=15000, uint32_t totalMs=60000) {
  if (length == 0 || length < -1 || (length > 0 && size_t(length) > limit)) return false;
  const uint32_t started=now(); uint32_t progress=started;
  size_t copied=0; uint8_t chunk[2048];
  for (;;) {
    if (length >= 0 && copied == size_t(length)) return true;
    const uint32_t current=now();
    if (uint32_t(current-started)>=totalMs || uint32_t(current-progress)>=idleMs) return false;
    const int available=client.available();
    if (available <= 0) {
      if (!client.connected()) return length == -1 && copied > 0;
      pause(); continue;
    }
    const size_t wanted=std::min(sizeof(chunk),std::min(size_t(available),length<0?sizeof(chunk):size_t(length)-copied));
    const int count=client.read(chunk,wanted);
    if (count <= 0) { pause(); continue; }
    if (size_t(count)>wanted || size_t(count)>limit-copied || sink.write(chunk,size_t(count))!=size_t(count)) return false;
    copied+=size_t(count); progress=now();
    pause();
  }
}
}

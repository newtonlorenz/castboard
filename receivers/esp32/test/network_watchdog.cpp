#include "../src/network_watchdog.h"
#include <cassert>

int main() {
  castboard::NetworkWatchdog watchdog;
  watchdog.noteProgress(1000);
  assert(!watchdog.claimRestart(181000));
  watchdog.noteProgress(181000);
  assert(!watchdog.claimRestart(181001));
  assert(!watchdog.claimRestart(180999));
  assert(watchdog.beginFirmwareUpdate());
  assert(!watchdog.claimRestart(361001));
  watchdog.endFirmwareUpdate();
  assert(watchdog.claimRestart(361001));
  assert(!watchdog.beginFirmwareUpdate());
  assert(!watchdog.claimRestart(361002));

  castboard::NetworkWatchdog wrapped;
  wrapped.noteProgress(UINT32_MAX - 1000);
  assert(!wrapped.claimRestart(1000));
  assert(wrapped.claimRestart(180000));
}

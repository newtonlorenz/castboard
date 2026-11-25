#pragma once
#include <atomic>
#include <cstdint>

namespace castboard {
class NetworkWatchdog {
 public:
  void noteProgress(uint32_t now) { progress_.store(now); }
  bool beginFirmwareUpdate() { return !exclusive_.exchange(true); }
  void endFirmwareUpdate() { exclusive_.store(false); }

  bool claimRestart(uint32_t now) {
    // Unsigned subtraction also measures elapsed time after millis() rolls over.
    if (!overdue(now) || exclusive_.exchange(true)) return false;
    if (overdue(now)) return true;
    exclusive_.store(false);
    return false;
  }

 private:
  bool overdue(uint32_t now) const {
    const uint32_t age = now - progress_.load();
    // Another task may record progress just after the caller samples millis().
    return age > 180000 && age < UINT32_MAX / 2;
  }
  std::atomic<uint32_t> progress_{0};
  // Only one of the OTA task and the application task may claim the board.
  std::atomic<bool> exclusive_{false};
};
}

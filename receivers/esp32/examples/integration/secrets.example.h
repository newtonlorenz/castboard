#pragma once
#define WIFI_SSID "your-wifi"
#define WIFI_PASSWORD "your-password"
#define CASTBOARD_SERVER "http://your-castboard-server:8787"
#define CASTBOARD_DEVICE_ID "your-display-id"
#define CASTBOARD_KEY "copy-the-one-time-key-from-displays"
// For HTTPS, put your CA certificate in a raw string here. Certificate checks
// are never disabled. HTTP should only be used on your trusted local network.
#define CASTBOARD_ROOT_CA nullptr

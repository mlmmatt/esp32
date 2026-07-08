// modules.js
// Catalog of supported ESP32 modules. Single source of truth for what a
// module needs (pin count, interface type, libraries) so the pin allocator
// (pinmap.js) can always produce a physically safe wiring.
//
// interface types:
//   "i2c"           -> shares the single I2C bus (SDA/SCL), no dedicated GPIO
//   "digital-out"   -> 1 dedicated GPIO, output-capable
//   "digital-in"    -> 1 dedicated GPIO, input-capable (any GPIO works)
//   "analog-in"     -> 1 dedicated GPIO, must come from the ADC1 pool (32-39)
//   "pwm"           -> 1 dedicated GPIO, output-capable + LEDC/PWM capable
//   "digital-multi" -> multiple dedicated GPIOs (count given by `pins`)
//   "camera"        -> special-cased, only valid on the ESP32-CAM board profile

const MODULE_CATALOG = [
  {
    id: "dht22",
    name: "DHT22 Temp/Humidity Sensor",
    category: "sensor",
    interface: "digital-in",
    pins: 1,
    boards: ["devkit"],
    notes: "Needs a 10k pull-up resistor between DATA and 3V3.",
    library: "DHT sensor library (Adafruit)",
  },
  {
    id: "bmp280",
    name: "BMP280 Pressure Sensor",
    category: "sensor",
    interface: "i2c",
    pins: 0,
    boards: ["devkit"],
    notes: "Shares the I2C bus. Default address 0x76 or 0x77.",
    library: "Adafruit BMP280",
  },
  {
    id: "oled_ssd1306",
    name: "SSD1306 OLED Display",
    category: "display",
    interface: "i2c",
    pins: 0,
    boards: ["devkit"],
    notes: "Shares the I2C bus. 128x64, address 0x3C.",
    library: "Adafruit SSD1306",
  },
  {
    id: "ws2812_strip",
    name: "WS2812B LED Strip",
    category: "output",
    interface: "digital-out",
    pins: 1,
    boards: ["devkit"],
    notes: "Single data line, precise timing handled by the library.",
    library: "Adafruit NeoPixel",
  },
  {
    id: "servo",
    name: "SG90 Servo",
    category: "output",
    interface: "pwm",
    pins: 1,
    boards: ["devkit"],
    notes: "50Hz PWM. Avoid pins shared with boot strapping.",
    library: "ESP32Servo",
  },
  {
    id: "relay",
    name: "Relay Module",
    category: "output",
    interface: "digital-out",
    pins: 1,
    boards: ["devkit"],
    notes: "Most boards are active-LOW.",
    library: "none (digitalWrite)",
  },
  {
    id: "pir",
    name: "PIR Motion Sensor",
    category: "sensor",
    interface: "digital-in",
    pins: 1,
    boards: ["devkit", "cam"],
    notes: "On the CAM board this pin can also be used as an RTC wake source.",
    library: "none (digitalRead / interrupt)",
  },
  {
    id: "rain_gauge",
    name: "Rain Gauge",
    category: "sensor",
    interface: "digital-in",
    pins: 1,
    boards: ["devkit"],
    notes: "Tipping-bucket pulse sensor. Use a pull-up and debounce the tips.",
    library: "none (interrupt / pulse counting)",
    signalType: "pulse",
    tutorSummary: "Each bucket tip equals a small fixed amount of rain.",
  },
  {
    id: "anemometer",
    name: "Anemometer",
    category: "sensor",
    interface: "digital-in",
    pins: 1,
    boards: ["devkit"],
    notes: "Pulse-output wind sensor. Wind speed depends on the sensor's calibration factor.",
    library: "none (interrupt / pulse counting)",
    signalType: "pulse",
    tutorSummary: "More pulses per second means higher wind speed.",
  },
  {
    id: "ultrasonic_hcsr04",
    name: "HC-SR04 Ultrasonic Sensor",
    category: "sensor",
    interface: "digital-multi",
    pins: 2,
    pinNames: ["TRIG", "ECHO"],
    boards: ["devkit"],
    notes: "TRIG is output, ECHO is input.",
    library: "none (pulseIn)",
  },
  {
    id: "buzzer",
    name: "Piezo Buzzer",
    category: "output",
    interface: "pwm",
    pins: 1,
    boards: ["devkit"],
    notes: "Driven via LEDC PWM for tone generation.",
    library: "none (ledcWriteTone)",
  },
  {
    id: "photoresistor",
    name: "Photoresistor (LDR)",
    category: "sensor",
    interface: "analog-in",
    pins: 1,
    boards: ["devkit"],
    notes: "Voltage divider into an ADC1 pin (avoids Wi-Fi/ADC2 conflicts).",
    library: "none (analogRead)",
  },
  {
    id: "potentiometer",
    name: "Potentiometer",
    category: "input",
    interface: "analog-in",
    pins: 1,
    boards: ["devkit"],
    notes: "ADC1 pin so it stays accurate while Wi-Fi is active.",
    library: "none (analogRead)",
  },
  {
    id: "push_button",
    name: "Push Button",
    category: "input",
    interface: "digital-in",
    pins: 1,
    boards: ["devkit"],
    notes: "Uses internal pull-up, active-LOW.",
    library: "none (digitalRead)",
  },
  {
    id: "rotary_encoder",
    name: "Rotary Encoder",
    category: "input",
    interface: "digital-multi",
    pins: 2,
    pinNames: ["CLK", "DT"],
    boards: ["devkit"],
    notes: "Optional SW (button) pin not included by default.",
    library: "none (interrupt-based quadrature)",
  },
  {
    id: "camera",
    name: "OV2640 Camera (onboard)",
    category: "sensor",
    interface: "camera",
    pins: 0,
    boards: ["cam"],
    notes: "Fixed parallel-bus pins on the AI-Thinker ESP32-CAM module.",
    library: "esp_camera",
  },
  {
    id: "solar_battery_monitor",
    name: "Solar/Battery Voltage Monitor",
    category: "power",
    interface: "analog-in",
    pins: 1,
    boards: ["devkit", "cam"],
    notes: "Voltage divider off the battery rail. Also enables deep-sleep code generation.",
    library: "none (analogRead)",
  },
];

const PRESETS = {
  led_party: {
    name: "LED Party",
    board: "devkit",
    modules: ["ws2812_strip", "potentiometer", "push_button"],
    description: "A reactive LED strip: potentiometer sets brightness, button cycles patterns.",
  },
  weather_station: {
    name: "Weather Station",
    board: "devkit",
    modules: ["dht22", "bmp280", "oled_ssd1306", "buzzer"],
    description: "Temp/humidity/pressure on an OLED dashboard, buzzer alert on thresholds.",
  },
  solar_camera_trap: {
    name: "Solar Camera Trap",
    board: "cam",
    modules: ["camera", "pir", "solar_battery_monitor"],
    description: "Motion-triggered camera that deep-sleeps between shots to run off a small solar panel.",
  },
};

if (typeof module !== "undefined") {
  module.exports = { MODULE_CATALOG, PRESETS };
}

if (typeof window !== "undefined") {
  window.MODULE_CATALOG = MODULE_CATALOG;
  window.PRESETS = PRESETS;
}
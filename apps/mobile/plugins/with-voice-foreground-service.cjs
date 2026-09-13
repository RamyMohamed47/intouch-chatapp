const { withAndroidManifest } = require("expo/config-plugins");

module.exports = (config) =>
  withAndroidManifest(config, (next) => {
    const application = next.modResults.manifest.application?.[0];
    if (!application) return next;
    application.service ??= [];
    const services = [
      {
        $: {
          "android:name": "com.supersami.foregroundservice.ForegroundService",
          "android:foregroundServiceType": "camera|microphone|mediaPlayback",
          "android:exported": "false",
        },
      },
      {
        $: {
          "android:name":
            "com.supersami.foregroundservice.ForegroundServiceTask",
          "android:exported": "false",
        },
      },
    ];
    for (const service of services) {
      if (
        !application.service.some(
          (entry) => entry.$?.["android:name"] === service.$["android:name"],
        )
      ) {
        application.service.push(service);
      }
    }
    return next;
  });

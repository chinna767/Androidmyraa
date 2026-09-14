package ai.myraa.voice;

import android.content.Context;
import android.content.Intent;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.media.AudioManager;
import android.net.Uri;
import android.provider.Settings;
import android.view.Window;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.PluginMethod;

@CapacitorPlugin(name = "MyraaDevice")
public class MyraaDevicePlugin extends Plugin {

    // =========================================================
    // TORCH
    // =========================================================

    private CameraManager cameraManager;
    private String torchCameraId = null;
    private boolean torchEnabled = false;

    // =========================================================
    // VOLUME
    // =========================================================

    private AudioManager audioManager;

    @Override
    public void load() {

        cameraManager =
                (CameraManager) getContext()
                        .getSystemService(Context.CAMERA_SERVICE);

        audioManager =
                (AudioManager) getContext()
                        .getSystemService(Context.AUDIO_SERVICE);

        findTorchCamera();
    }

    // =========================================================
    // TORCH METHODS
    // =========================================================

    private void findTorchCamera() {

        try {

            for (String cameraId :
                    cameraManager.getCameraIdList()) {

                CameraCharacteristics characteristics =
                        cameraManager.getCameraCharacteristics(
                                cameraId
                        );

                Boolean flashAvailable =
                        characteristics.get(
                                CameraCharacteristics
                                        .FLASH_INFO_AVAILABLE
                        );

                Integer lensFacing =
                        characteristics.get(
                                CameraCharacteristics
                                        .LENS_FACING
                        );

                if (Boolean.TRUE.equals(flashAvailable)
                        && lensFacing != null
                        && lensFacing ==
                        CameraCharacteristics
                                .LENS_FACING_BACK) {

                    torchCameraId = cameraId;
                    return;
                }
            }

        } catch (Exception e) {

            android.util.Log.e(
                    "MYRAA_DEVICE",
                    "Torch camera detection failed",
                    e
            );
        }
    }

    private boolean setTorch(boolean enabled) {

        try {

            if (torchCameraId == null) {
                findTorchCamera();
            }

            if (torchCameraId == null) {
                return false;
            }

            cameraManager.setTorchMode(
                    torchCameraId,
                    enabled
            );

            torchEnabled = enabled;

            return true;

        } catch (Exception e) {

            android.util.Log.e(
                    "MYRAA_DEVICE",
                    "Torch operation failed",
                    e
            );

            return false;
        }
    }

    @PluginMethod
    public void turnTorchOn(PluginCall call) {

        boolean success = setTorch(true);

        JSObject result = new JSObject();

        result.put("success", success);
        result.put("enabled",
                success && torchEnabled);

        call.resolve(result);
    }

    @PluginMethod
    public void turnTorchOff(PluginCall call) {

        boolean success = setTorch(false);

        JSObject result = new JSObject();

        result.put("success", success);
        result.put("enabled", false);

        call.resolve(result);
    }

    @PluginMethod
    public void toggleTorch(PluginCall call) {

        boolean newState = !torchEnabled;

        boolean success = setTorch(newState);

        JSObject result = new JSObject();

        result.put("success", success);
        result.put("enabled",
                success && newState);

        call.resolve(result);
    }

    @PluginMethod
    public void getTorchStatus(PluginCall call) {

        JSObject result = new JSObject();

        result.put(
                "available",
                torchCameraId != null
        );

        result.put(
                "enabled",
                torchEnabled
        );

        call.resolve(result);
    }

    // =========================================================
    // REAL ANDROID VOLUME
    // =========================================================

    @PluginMethod
    public void getVolume(PluginCall call) {

        int currentVolume =
                audioManager.getStreamVolume(
                        AudioManager.STREAM_MUSIC
                );

        int maxVolume =
                audioManager.getStreamMaxVolume(
                        AudioManager.STREAM_MUSIC
                );

        int percent =
                Math.round(
                        (currentVolume * 100f)
                                / maxVolume
                );

        JSObject result = new JSObject();

        result.put("success", true);
        result.put("volume", percent);
        result.put("current", currentVolume);
        result.put("max", maxVolume);

        call.resolve(result);
    }

    @PluginMethod
    public void setVolume(PluginCall call) {

        int requestedVolume =
                call.getInt("volume", 50);

        requestedVolume =
                Math.max(
                        0,
                        Math.min(100, requestedVolume)
                );

        int maxVolume =
                audioManager.getStreamMaxVolume(
                        AudioManager.STREAM_MUSIC
                );

        int targetVolume =
                Math.round(
                        (requestedVolume / 100f)
                                * maxVolume
                );

        try {

            audioManager.setStreamVolume(
                    AudioManager.STREAM_MUSIC,
                    targetVolume,
                    0
            );

            JSObject result = new JSObject();

            result.put("success", true);
            result.put("volume", requestedVolume);

            call.resolve(result);

        } catch (Exception e) {

            JSObject result = new JSObject();

            result.put("success", false);
            result.put("volume", requestedVolume);
            result.put(
                    "error",
                    e.getMessage()
            );

            call.resolve(result);
        }
    }

    @PluginMethod
    public void increaseVolume(PluginCall call) {

        int step =
                call.getInt("step", 10);

        int current =
                audioManager.getStreamVolume(
                        AudioManager.STREAM_MUSIC
                );

        int max =
                audioManager.getStreamMaxVolume(
                        AudioManager.STREAM_MUSIC
                );

        int currentPercent =
                Math.round(
                        current * 100f / max
                );

        int newPercent =
                Math.min(
                        100,
                        currentPercent + step
                );

        int target =
                Math.round(
                        newPercent / 100f * max
                );

        audioManager.setStreamVolume(
                AudioManager.STREAM_MUSIC,
                target,
                0
        );

        JSObject result = new JSObject();

        result.put("success", true);
        result.put("volume", newPercent);

        call.resolve(result);
    }

    @PluginMethod
    public void decreaseVolume(PluginCall call) {

        int step =
                call.getInt("step", 10);

        int current =
                audioManager.getStreamVolume(
                        AudioManager.STREAM_MUSIC
                );

        int max =
                audioManager.getStreamMaxVolume(
                        AudioManager.STREAM_MUSIC
                );

        int currentPercent =
                Math.round(
                        current * 100f / max
                );

        int newPercent =
                Math.max(
                        0,
                        currentPercent - step
                );

        int target =
                Math.round(
                        newPercent / 100f * max
                );

        audioManager.setStreamVolume(
                AudioManager.STREAM_MUSIC,
                target,
                0
        );

        JSObject result = new JSObject();

        result.put("success", true);
        result.put("volume", newPercent);

        call.resolve(result);
    }

    // =========================================================
    // SYSTEM BRIGHTNESS
    // =========================================================

    @PluginMethod
    public void canWriteSystemSettings(
            PluginCall call
    ) {

        boolean allowed =
                Settings.System.canWrite(
                        getContext()
                );

        JSObject result = new JSObject();

        result.put("allowed", allowed);

        call.resolve(result);
    }

    @PluginMethod
    public void openWriteSettingsPermission(
            PluginCall call
    ) {

        try {

            Intent intent =
                    new Intent(
                            Settings
                                    .ACTION_MANAGE_WRITE_SETTINGS
                    );

            intent.setData(
                    Uri.parse(
                            "package:"
                                    + getContext()
                                    .getPackageName()
                    )
            );

            intent.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK
            );

            getContext().startActivity(intent);

            JSObject result = new JSObject();

            result.put("success", true);

            call.resolve(result);

        } catch (Exception e) {

            JSObject result = new JSObject();

            result.put("success", false);

            result.put(
                    "error",
                    e.getMessage()
            );

            call.resolve(result);
        }
    }

    @PluginMethod
    public void getSystemBrightness(
            PluginCall call
    ) {

        try {

            int brightness =
                    Settings.System.getInt(
                            getContext()
                                    .getContentResolver(),
                            Settings.System
                                    .SCREEN_BRIGHTNESS
                    );

            int percent =
                    Math.round(
                            brightness * 100f / 255f
                    );

            JSObject result = new JSObject();

            result.put("success", true);
            result.put("brightness", percent);

            call.resolve(result);

        } catch (Exception e) {

            JSObject result = new JSObject();

            result.put("success", false);

            result.put(
                    "error",
                    e.getMessage()
            );

            call.resolve(result);
        }
    }

    @PluginMethod
    public void setSystemBrightness(
            PluginCall call
    ) {

        int requestedBrightness =
                call.getInt("brightness", 50);

        requestedBrightness =
                Math.max(
                        1,
                        Math.min(
                                100,
                                requestedBrightness
                        )
                );

        if (!Settings.System.canWrite(
                getContext()
        )) {

            JSObject result = new JSObject();

            result.put("success", false);

            result.put(
                    "permissionRequired",
                    true
            );

            result.put(
                    "error",
                    "WRITE_SETTINGS_PERMISSION_REQUIRED"
            );

            call.resolve(result);

            return;
        }

        try {

            int androidBrightness =
                    Math.round(
                            requestedBrightness
                                    * 255f
                                    / 100f
                    );

            Settings.System.putInt(
                    getContext()
                            .getContentResolver(),

                    Settings.System
                            .SCREEN_BRIGHTNESS,

                    androidBrightness
            );

            JSObject result = new JSObject();

            result.put("success", true);

            result.put(
                    "brightness",
                    requestedBrightness
            );

            call.resolve(result);

        } catch (Exception e) {

            JSObject result = new JSObject();

            result.put("success", false);

            result.put(
                    "error",
                    e.getMessage()
            );

            call.resolve(result);
        }
    }
}

# ============================================================================
# Rhythm Riot — R8 / ProGuard keep rules for the minified release build.
# Capacitor loads plugins and bridges JS↔native via reflection, so those classes
# and annotated members must survive shrinking or the release build will crash.
# ============================================================================

# --- Keep line numbers so crash stack traces stay readable via mapping.txt ---
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
-keepattributes *Annotation*,Signature,Exceptions,InnerClasses,EnclosingMethod

# --- Capacitor core + bridge ---
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
}

# --- First-party Capacitor plugins (e.g. @capacitor/preferences) ---
-keep class com.capacitorjs.plugins.** { *; }

# --- Cordova compatibility layer (Capacitor bundles it) ---
-keep class org.apache.cordova.** { *; }

# --- JavaScript interfaces exposed to the WebView ---
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# --- AndroidX WebKit ---
-keep class androidx.webkit.** { *; }

# --- Silence notes about optional/again-reflected classes ---
-dontwarn com.getcapacitor.**
-dontwarn org.apache.cordova.**

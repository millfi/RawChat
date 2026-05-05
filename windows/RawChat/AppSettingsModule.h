#pragma once

// REACT_MODULE / REACT_METHOD / ReactPromise / MakeModuleProvider all live
// in NativeModules.h. The official RNW cpp-lib template includes this header
// (and JSValue.h) at the top of every native module — relying on transitive
// inclusion is fragile and was the root cause of "AppSettingsModule not
// available via TurboModuleRegistry" warnings.
#include <JSValue.h>
#include <NativeModules.h>
#include <winrt/Windows.Storage.h>

// ---------------------------------------------------------------------------
// AppSettingsModule
//
// A minimal native module that persists simple string key-value pairs using
// WinRT ApplicationData.Current.LocalSettings (packaged-app sandbox storage).
//
// Registered explicitly from RawChat.cpp via
//     packageBuilder.AddTurboModule(L"AppSettingsModule",
//         winrt::Microsoft::ReactNative::MakeModuleProvider<AppSettingsModule>())
// rather than relying on REACT_MODULE's static-initializer auto-registration,
// which the MSVC linker can eliminate from app .obj files.
//
// JavaScript interface (TurboModuleRegistry.get('AppSettingsModule')):
//   setString(key: string, value: string): Promise<void>
//   getString(key: string): Promise<string>   // resolves "" when not found
// ---------------------------------------------------------------------------

REACT_MODULE_NOREG(AppSettingsModule);
struct AppSettingsModule {

  // ── setString ──────────────────────────────────────────────────────────
  REACT_METHOD(SetString, L"setString");
  void SetString(
      std::string key,
      std::string value,
      winrt::Microsoft::ReactNative::ReactPromise<void> promise) noexcept {
    try {
      auto settings =
          winrt::Windows::Storage::ApplicationData::Current().LocalSettings();
      settings.Values().Insert(
          winrt::to_hstring(key),
          winrt::box_value(winrt::to_hstring(value)));
      promise.Resolve();
    } catch (winrt::hresult_error const &ex) {
      promise.Reject(winrt::to_string(ex.message()).c_str());
    }
  }

  // ── getString ──────────────────────────────────────────────────────────
  REACT_METHOD(GetString, L"getString");
  void GetString(
      std::string key,
      winrt::Microsoft::ReactNative::ReactPromise<std::string> promise) noexcept {
    try {
      auto settings =
          winrt::Windows::Storage::ApplicationData::Current().LocalSettings();
      auto valueObj = settings.Values().TryLookup(winrt::to_hstring(key));
      if (valueObj) {
        promise.Resolve(
            winrt::to_string(winrt::unbox_value<winrt::hstring>(valueObj)));
      } else {
        promise.Resolve(std::string{});
      }
    } catch (winrt::hresult_error const &ex) {
      promise.Reject(winrt::to_string(ex.message()).c_str());
    }
  }
};

import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Lightweight cross-component preference store (no Redux needed)
const _listeners = new Map();
const _cache = {};

function makePreference(key, defaultValue) {
  let loaded = false;

  function usePreference() {
    const [value, setValue] = useState(() => _cache[key] ?? defaultValue);

    useEffect(() => {
      if (!loaded) {
        loaded = true;
        AsyncStorage.getItem(key).then(stored => {
          const parsed = stored === null ? defaultValue : stored === 'true';
          _cache[key] = parsed;
          (_listeners.get(key) ?? new Set()).forEach(fn => fn(parsed));
        });
      }
      if (!_listeners.has(key)) _listeners.set(key, new Set());
      _listeners.get(key).add(setValue);
      return () => _listeners.get(key)?.delete(setValue);
    }, []);

    function set(newVal) {
      _cache[key] = newVal;
      AsyncStorage.setItem(key, String(newVal));
      (_listeners.get(key) ?? new Set()).forEach(fn => fn(newVal));
    }

    return [value, set];
  }

  return usePreference;
}

export const useShowCountryName = makePreference('pref_showCountryName', true);

/*
========================================================
COFFEE SPOT — PICK-UP LOCATION HELPER
========================================================
Direct flow:
Pick-up → Detect My Location → Allow permission →
Get Directions → Google Maps

This file is intentionally additive. It does not replace the
existing order, cart, product, or checkout logic.
========================================================
*/
(() => {
  const init = () => {
    const pickupButton = document.getElementById('pickupMethodBtn');
    const locationBox = document.getElementById('pickupLocationAddon');
    const detectButton = document.getElementById('pickupDetectLocation');
    const storeButton = document.getElementById('pickupOpenStore');
    const directionsButton = document.getElementById('pickupGetDirections');
    const status = document.getElementById('pickupLocationStatus');

    if (!pickupButton || !locationBox || !detectButton || !storeButton || !directionsButton || !status) return;

    const STORE_MAP_URL = 'https://maps.app.goo.gl/NUfP9dRwQyWhnwF47';
    const STORE_DESTINATION = 'Coffee Spot, 2124 Tayabas - Lucena Road, Lucena City, Philippines';

    let customerPosition = null;

    const setStatus = (message, state = '') => {
      status.textContent = message;
      status.dataset.state = state;
    };

    const isPickupSelected = () => (
      pickupButton.classList.contains('selected') ||
      pickupButton.getAttribute('aria-pressed') === 'true'
    );

    const syncPickupPanel = () => {
      locationBox.classList.toggle('is-visible', isPickupSelected());
    };

    pickupButton.addEventListener('click', () => window.setTimeout(syncPickupPanel, 0));
    syncPickupPanel();

    detectButton.addEventListener('click', () => {
      if (!navigator.geolocation) {
        setStatus('Location services are not supported by this browser.', 'error');
        return;
      }

      if (!window.isSecureContext) {
        setStatus('Location access requires HTTPS or localhost. Open the site through a secure address and try again.', 'error');
        return;
      }

      detectButton.disabled = true;
      directionsButton.disabled = true;
      setStatus('Finding your location… please allow the browser permission request.', 'loading');

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;

          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            customerPosition = null;
            setStatus('The browser returned an invalid location. Please try again.', 'error');
            detectButton.disabled = false;
            return;
          }

          customerPosition = { latitude, longitude, accuracy };
          const accuracyText = Number.isFinite(accuracy) ? ` Approx. accuracy: ${Math.round(accuracy)} m.` : '';
          setStatus(`✓ Your location was detected.${accuracyText}`, 'success');

          directionsButton.disabled = false;
          detectButton.disabled = false;
        },
        (error) => {
          customerPosition = null;

          const messages = {
            1: 'Location permission was denied. Allow location access in your browser settings, then try again.',
            2: 'Your device could not determine its location right now. Please try again.',
            3: 'The location request timed out. Please try again.'
          };

          setStatus(messages[error.code] || 'We could not get your location. Please try again.', 'error');
          detectButton.disabled = false;
          directionsButton.disabled = true;
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0
        }
      );
    });

    storeButton.addEventListener('click', () => {
      window.open(STORE_MAP_URL, '_blank', 'noopener,noreferrer');
    });

    directionsButton.addEventListener('click', () => {
      if (!customerPosition) {
        setStatus('Detect your location first, then tap Get Directions.', 'error');
        return;
      }

      const origin = `${customerPosition.latitude},${customerPosition.longitude}`;
      const mapsUrl = new URL('https://www.google.com/maps/dir/');
      mapsUrl.searchParams.set('api', '1');
      mapsUrl.searchParams.set('origin', origin);
      mapsUrl.searchParams.set('destination', STORE_DESTINATION);
      mapsUrl.searchParams.set('travelmode', 'driving');
      mapsUrl.searchParams.set('dir_action', 'navigate');

      window.open(mapsUrl.toString(), '_blank', 'noopener,noreferrer');
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

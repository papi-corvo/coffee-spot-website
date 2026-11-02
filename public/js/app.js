// ===== Order start: delivery or pick-up must be selected before the menu =====
const orderStartOverlay = document.getElementById('orderStartOverlay');
  const deliveryMethodBtn = document.getElementById('deliveryMethodBtn');
  const pickupMethodBtn = document.getElementById('pickupMethodBtn');
  const deliveryForm = document.getElementById('deliveryForm');
  const orderStartContinue = document.getElementById('orderStartContinue');
  const orderStartError = document.getElementById('orderStartError');
  const fullNameInput = document.getElementById('addressFullName');
  const phoneInput = document.getElementById('addressPhone');
  const streetInput = document.getElementById('addressStreet');
  const barangaySelect = document.getElementById('addressBarangay');
  const citySelect = document.getElementById('addressCity');


  (() => {
  const overlay = document.getElementById('orderStartOverlay');
  const input   = document.getElementById('orderReceiverName');
  const error   = document.getElementById('orderStartError');
  const NAME_RULE = /^\p{L}[\p{L}\p{M} .'-]{1,59}$/u;   // letters, spaces, . ' -
  if (!overlay || !input || !error) return;

  const clean = () => input.value.replace(/\s+/g, ' ').trim();

  function fail(msg) {
    error.textContent = msg;
    error.classList.add('show');
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  }

  // Capture phase on the overlay runs BEFORE main.js's handler on the button,
  // so we can block "Continue" without editing main.js.
  overlay.addEventListener('click', (e) => {
    if (!e.target.closest('#orderStartContinue')) return;
    const name = clean();
    if (!name) {
      e.stopImmediatePropagation(); e.preventDefault();
      return fail('Please enter the name of the person receiving the order.');
    }
    if (!NAME_RULE.test(name)) {
      e.stopImmediatePropagation(); e.preventDefault();
      return fail('Use letters only (2 to 60 characters).');
    }
    input.removeAttribute('aria-invalid');
    error.classList.remove('show');
    sessionStorage.setItem('cs_receiver_name', name);
  }, true);

  input.addEventListener('input', () => input.removeAttribute('aria-invalid'));
})();
  let orderMethod = '';
  let deliveryAddress = null;

  const deliveryLocations = window.COFFEE_SPOT_DELIVERY_LOCATIONS || {};

  function setFieldError(field, message) {
    field.setCustomValidity(message);
    field.setAttribute('aria-invalid', 'true');
  }

  function clearFieldError(field) {
    field.setCustomValidity('');
    field.removeAttribute('aria-invalid');
  }

  function showOrderError(message, field = null) {
    orderStartError.textContent = message;
    orderStartError.classList.add('show');
    if (field) field.focus();
  }

  function clearOrderError() {
    orderStartError.classList.remove('show');
    orderStartError.textContent = '';
  }

  function populateBarangays(city) {
    const barangays = deliveryLocations[city] || [];
    const currentValue = barangaySelect.value;

    barangaySelect.replaceChildren(new Option('Select your barangay', ''));

    barangays.forEach((barangay) => {
      barangaySelect.add(new Option(barangay, barangay));
    });

    barangaySelect.disabled = barangays.length === 0;
    barangaySelect.value = barangays.includes(currentValue) ? currentValue : '';
    clearFieldError(barangaySelect);
  }

  function sanitizePhoneInput() {
    const digitsOnly = phoneInput.value.replace(/\D/g, '').slice(0, 11);
    phoneInput.value = digitsOnly;
    clearFieldError(phoneInput);

    if (digitsOnly && !/^09\d{0,9}$/.test(digitsOnly)) {
      setFieldError(phoneInput, 'Enter a Philippine mobile number starting with 09.');
      return false;
    }

    if (digitsOnly && digitsOnly.length === 11 && !/^09\d{9}$/.test(digitsOnly)) {
      setFieldError(phoneInput, 'Enter an 11-digit Philippine mobile number.');
      return false;
    }

    return true;
  }

  function setOrderMethod(method) {
    orderMethod = method;
    orderStartOverlay.dataset.method = method;
    const isDelivery = method === 'delivery';

    deliveryMethodBtn.classList.toggle('selected', isDelivery);
    pickupMethodBtn.classList.toggle('selected', method === 'pickup');
    deliveryMethodBtn.setAttribute('aria-pressed', String(isDelivery));
    pickupMethodBtn.setAttribute('aria-pressed', String(method === 'pickup'));
    deliveryForm.classList.toggle('show', isDelivery);
    clearOrderError();

    if (method === 'pickup') {
      orderStartContinue.disabled = false;
      orderStartContinue.textContent = 'PROCEED TO MENU';
    } else {
      orderStartContinue.disabled = false;
      orderStartContinue.textContent = 'CONTINUE TO MENU';
    }
  }

  function validateDeliveryAddress() {
    [fullNameInput, phoneInput, streetInput, barangaySelect, citySelect].forEach(clearFieldError);

    const fullName = fullNameInput.value.trim();
    const street = streetInput.value.trim();
    const phone = phoneInput.value.trim();
    const barangay = barangaySelect.value.trim();
    const city = citySelect.value.trim();

    if (!fullName) {
      setFieldError(fullNameInput, 'Full name is required.');
      showOrderError('Please enter your full name.', fullNameInput);
      return false;
    }

    if (!street) {
      setFieldError(streetInput, 'House, unit, or street is required.');
      showOrderError('Please enter your house, unit, or street.', streetInput);
      return false;
    }

    if (!city || !Object.prototype.hasOwnProperty.call(deliveryLocations, city)) {
      setFieldError(citySelect, 'Select a supported city or municipality.');
      showOrderError('Please select a city or municipality from the delivery area.', citySelect);
      return false;
    }

    if (!barangay || !deliveryLocations[city].includes(barangay)) {
      setFieldError(barangaySelect, 'Select a barangay from the selected city or municipality.');
      showOrderError('Please select a valid barangay for the selected city or municipality.', barangaySelect);
      return false;
    }

    if (phone && !/^09\d{9}$/.test(phone)) {
      setFieldError(phoneInput, 'Enter an 11-digit Philippine mobile number or leave it blank.');
      showOrderError('Phone number is optional, but if provided it must contain exactly 11 digits and start with 09.', phoneInput);
      return false;
    }

    deliveryAddress = {
      fullName,
      phone,
      street,
      barangay,
      city,
      notes: document.getElementById('addressNotes').value.trim()
    };

    clearOrderError();
    return true;
  }

  function finishOrderSetup() {
    orderStartOverlay.classList.add('is-hidden');
    document.body.classList.remove('order-setup-active');
    window.scrollTo(0, 0);
  }

  citySelect.addEventListener('change', () => {
    populateBarangays(citySelect.value);
    clearOrderError();
  });

  phoneInput.addEventListener('input', sanitizePhoneInput);

  [fullNameInput, streetInput].forEach((field) => {
    field.addEventListener('input', () => clearFieldError(field));
  });

  barangaySelect.addEventListener('change', () => clearFieldError(barangaySelect));

  populateBarangays(citySelect.value);

  deliveryMethodBtn.addEventListener('click', () => setOrderMethod('delivery'));
  pickupMethodBtn.addEventListener('click', () => setOrderMethod('pickup'));

  orderStartContinue.addEventListener('click', () => {
    if (!orderMethod) return;

    if (orderMethod === 'delivery' && !validateDeliveryAddress()) return;

    finishOrderSetup();
  });

  // Keep the selected order details available to the existing cart/checkout logic.
  window.CoffeeSpotOrder = {
    get method() { return orderMethod; },
    get address() { return deliveryAddress; },
    get receiverName() { return sessionStorage.getItem('cs_receiver_name') || ''; }
  };

// ===== Featured taste screen: bridge between order setup and the full menu =====
const featuredTasteScreen = document.getElementById('featuredTasteScreen');
const featuredMenuButton = document.getElementById('featuredMenuButton');
const featuredCoffeeImage = document.getElementById('featuredCoffeeImage');
const featuredMiniImage = document.getElementById('featuredMiniImage');
const featuredCoffeeName = document.getElementById('featuredCoffeeName');
const featuredMiniName = document.getElementById('featuredMiniName');
const featuredMiniDescription = document.getElementById('featuredMiniDescription');


function getFeaturedCoffee() {
  const preferredNames = ['Cafe Americano', 'Cafe Latte', 'Mocha Latte', 'Caramel Macchiato', 'Matcha Latte'];
  const available = preferredNames.map((name) => document.querySelector(`li.product-row[data-item-name="${name}"]`)).filter(Boolean);
  const fallback = Array.from(document.querySelectorAll('#coffee li.product-row[data-item-name]'));
  const choices = available.length ? available : fallback;
  const row = choices[Math.floor(Math.random() * choices.length)];

  if (!row) return { name: 'Coffee Spot Favorite', image: '', desc: 'Freshly brewed and made for your perfect coffee moment.' };

  const name = row.dataset.itemName || 'Coffee Spot Favorite';
  const image = row.querySelector('img')?.getAttribute('src') || '';
  const info = typeof PRODUCT_INFO !== 'undefined' && PRODUCT_INFO[name] ? PRODUCT_INFO[name] : null;
  return { name, image, desc: info?.desc || 'A Coffee Spot favorite, freshly made for your perfect coffee moment.' };
}

function openFeaturedTasteScreen() {
  const coffee = getFeaturedCoffee();
  featuredCoffeeName.textContent = coffee.name;
  featuredMiniName.textContent = coffee.name;
  featuredMiniDescription.textContent = coffee.desc;
  featuredCoffeeImage.src = coffee.image;
  featuredMiniImage.src = coffee.image;
  featuredCoffeeImage.alt = coffee.name;
  featuredMiniImage.alt = coffee.name;

  featuredTasteScreen.classList.remove('is-leaving');
  featuredTasteScreen.classList.add('is-visible');
  featuredTasteScreen.setAttribute('aria-hidden', 'false');
}

function closeFeaturedTasteScreen() {
  if (!featuredTasteScreen.classList.contains('is-visible')) return;
  featuredTasteScreen.classList.remove('is-visible');
  featuredTasteScreen.classList.add('is-leaving');

  // show the Delivery / Pick-up card underneath as the featured screen slides away
  orderStartOverlay.classList.remove('is-hidden');
  const nameField = document.getElementById('orderReceiverName');
  if (nameField) window.setTimeout(() => nameField.focus(), 400);

  featuredTasteScreen.addEventListener('animationend', () => {
    featuredTasteScreen.classList.remove('is-leaving');
    featuredTasteScreen.setAttribute('aria-hidden', 'true');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, { once: true });
}

featuredMenuButton.addEventListener('click', closeFeaturedTasteScreen);
window.setTimeout(openFeaturedTasteScreen, 0);   // fills in the featured coffee once the whole script has loaded

// ===== Responsive navigation =====
    const sidebar = document.getElementById('sidebar');
    const mobileCategoryLinks = document.querySelectorAll('.mobile-category-nav a');

    mobileCategoryLinks.forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // ===== Sidebar scrollspy: highlight the section currently in view =====
    const navLinks = Array.from(document.querySelectorAll('.side-nav a'));
    const sections = navLinks
      .map((a) => document.querySelector(a.getAttribute('href')))
      .filter(Boolean);

    const spyObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const link = navLinks.find((a) => a.getAttribute('href') === '#' + entry.target.id);
        if (!link) return;
        if (entry.isIntersecting) {
          navLinks.forEach((a) => a.classList.remove('active'));
          link.classList.add('active');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

    sections.forEach((section) => spyObserver.observe(section));
    if (navLinks[0]) navLinks[0].classList.add('active');

    // ===== Product info: tap an item's name to expand its own details =====
    const PRODUCT_INFO = {
      'Cafe Americano': {
        desc: 'Smooth espresso shots layered over hot water for a clean, bold coffee flavor.',
        ingredients: ['Espresso shots', 'Hot water'],
      },
      'Espresso': {
        desc: 'A concentrated shot of freshly pulled espresso — rich, dark, and intense.',
        ingredients: ['Espresso beans'],
      },
      'Double Espresso': {
        desc: 'Two shots of espresso for an extra energizing kick.',
        ingredients: ['Double espresso shot'],
      },
      'Cafe Latte': {
        desc: 'Espresso balanced with steamed milk for a creamy, comforting sip.',
        ingredients: ['Espresso', 'Steamed milk', 'Milk foam'],
      },
      'Mocha Latte': {
        desc: 'Espresso and chocolate blended with steamed milk for a sweet coffee treat.',
        ingredients: ['Espresso', 'Chocolate syrup', 'Steamed milk'],
      },
      'Cappuccino': {
        desc: 'Equal parts espresso, steamed milk, and velvety foam.',
        ingredients: ['Espresso', 'Steamed milk', 'Milk foam'],
      },
      'Caramel Macchiato': {
        desc: 'Espresso marked with vanilla and milk, finished with a caramel drizzle.',
        ingredients: ['Espresso', 'Vanilla syrup', 'Steamed milk', 'Caramel drizzle'],
      },
      'English Toffee': {
        desc: 'A buttery toffee-flavored coffee with a smooth, sweet finish.',
        ingredients: ['Espresso', 'Toffee syrup', 'Steamed milk'],
      },
      'Matcha Latte': {
        desc: 'Stone-ground matcha whisked with steamed milk for an earthy, calming cup.',
        ingredients: ['Matcha powder', 'Steamed milk'],
      },
      'Matcha Caramel': {
        desc: 'Our matcha latte with a caramel twist for extra sweetness.',
        ingredients: ['Matcha powder', 'Steamed milk', 'Caramel syrup'],
      },
      'Hazelnut': {
        desc: 'Espresso flavored with roasted hazelnut and steamed milk.',
        ingredients: ['Espresso', 'Hazelnut syrup', 'Steamed milk'],
      },
      'Macadamia': {
        desc: 'A nutty, buttery macadamia-flavored coffee.',
        ingredients: ['Espresso', 'Macadamia syrup', 'Steamed milk'],
      },
      'Roasted Almond': {
        desc: 'Toasted almond notes paired with smooth espresso.',
        ingredients: ['Espresso', 'Roasted almond syrup', 'Steamed milk'],
      },
      'Hot Bellagio Chocolate': {
        desc: 'Rich hot chocolate made with real cocoa, silky and indulgent.',
        ingredients: ['Cocoa', 'Chocolate syrup', 'Steamed milk'],
      },
      'Barista Drink': {
        desc: "Our barista's signature blend — a specialty creation you won't find elsewhere.",
        ingredients: ['Espresso', 'House special syrup blend', 'Steamed milk'],
      },
      'Dirty Matcha': {
        desc: 'Matcha latte topped with a shot of espresso for the best of both worlds.',
        ingredients: ['Matcha powder', 'Steamed milk', 'Espresso shot'],
      },
      'Salted Caramel': {
        desc: 'Sweet caramel with a hint of sea salt, in every sip.',
        ingredients: ['Espresso', 'Caramel syrup', 'Sea salt', 'Milk'],
      },
      'Dark Chocolate': {
        desc: 'Deep, rich dark chocolate blended with espresso.',
        ingredients: ['Espresso', 'Dark chocolate syrup', 'Steamed milk'],
      },
      'Biscoff Latte': {
        desc: 'Espresso latte infused with warm, spiced Biscoff cookie flavor.',
        ingredients: ['Espresso', 'Biscoff syrup', 'Steamed milk', 'Biscoff cookie crumble'],
      },
      'Cookies & Cream': {
        desc: 'Blended cookies and cream, cold and dreamy.',
        ingredients: ['Milk', 'Crushed cookies', 'Ice', 'Whipped cream'],
      },
      'Matcha': {
        desc: 'Smooth matcha, blended cool and creamy — earthy and refreshing.',
        ingredients: ['Matcha powder', 'Milk', 'Ice'],
      },
      'Double Chocolate': {
        desc: 'Double the chocolate, blended into a cool, creamy frappe.',
        ingredients: ['Chocolate syrup', 'Milk', 'Ice'],
      },
      'Vanilla Bean Hazelnut': {
        desc: 'Vanilla bean and roasted hazelnut blended into a smooth frappe.',
        ingredients: ['Vanilla bean syrup', 'Hazelnut syrup', 'Milk', 'Ice'],
      },
      'Strawberry': {
        desc: 'Sweet strawberry blended into a fruity, creamy frappe.',
        ingredients: ['Strawberry syrup', 'Milk', 'Ice'],
      },
      'Mocha Crumble': {
        desc: 'Mocha frappe topped with a crunchy cookie crumble.',
        ingredients: ['Espresso', 'Chocolate syrup', 'Milk', 'Ice', 'Cookie crumble'],
      },
      'Salted Caramel Frappe': {
        desc: 'A creamy blended frappe with rich caramel sweetness and a lightly salted finish.',
        ingredients: ['Blended ice', 'Milk', 'Caramel syrup', 'Salted caramel'],
      },
      'Mocha Frappe': {
        desc: 'Classic mocha, blended cold and creamy.',
        ingredients: ['Espresso', 'Chocolate syrup', 'Milk', 'Ice'],
      },
      'Butterscotch': {
        desc: 'Buttery, caramel-sweet butterscotch blended into a chilled coffee frappe.',
        ingredients: ['Espresso', 'Butterscotch syrup', 'Milk', 'Ice'],
      },
      'Passion Fruit': {
        desc: 'Tangy passion fruit soda over ice, tropical and refreshing.',
        ingredients: ['Passion fruit syrup', 'Soda water', 'Ice'],
      },
      'Green Apple': {
        desc: 'Crisp green apple soda, tart and fizzy.',
        ingredients: ['Green apple syrup', 'Soda water', 'Ice'],
      },
      'Minty Peach': {
        desc: 'Sweet peach with a cooling mint finish.',
        ingredients: ['Peach syrup', 'Mint', 'Soda water', 'Ice'],
      },
      'Scarlet Berry': {
        desc: 'A vibrant mix of berries, sweet and fruity.',
        ingredients: ['Mixed berry syrup', 'Soda water', 'Ice'],
      },
      'Lychee': {
        desc: 'Fragrant lychee soda, light and floral.',
        ingredients: ['Lychee syrup', 'Soda water', 'Ice'],
      },
      'Green Tea': {
        desc: 'Light and grassy green tea, gently brewed.',
        ingredients: ['Green tea leaves', 'Hot water'],
      },
      'Black Tea': {
        desc: 'Bold, full-bodied black tea, classic and comforting.',
        ingredients: ['Black tea leaves', 'Hot water'],
      },
      'White Tea': {
        desc: 'Delicate white tea with a subtle, mellow sweetness.',
        ingredients: ['White tea leaves', 'Hot water'],
      },
      'Blueberry Cheesecake': {
        desc: 'Creamy cheesecake topped with sweet blueberry compote.',
        ingredients: ['Cream cheese', 'Graham cracker crust', 'Blueberry compote'],
      },
      'Biscoff Cheesecake': {
        desc: 'Rich cheesecake swirled with spiced Biscoff cookie butter.',
        ingredients: ['Cream cheese', 'Graham cracker crust', 'Biscoff cookie butter'],
      },
      'Brownie Cheesecake': {
        desc: 'Fudgy brownie layered with creamy cheesecake.',
        ingredients: ['Brownie', 'Cream cheese', 'Chocolate'],
      },
      'Smores Brownie': {
        desc: 'Fudgy brownie loaded with marshmallow, chocolate, and graham crumble.',
        ingredients: ['Brownie', 'Marshmallow', 'Chocolate', 'Graham cracker crumble'],
      },
      'Biscoff Brownie': {
        desc: 'Rich brownie topped with Biscoff cookie butter and crumble.',
        ingredients: ['Brownie', 'Biscoff cookie butter', 'Biscoff cookie crumble'],
      },
      'Chocolate Chip Ala Mode': {
        desc: 'Classic chocolate chip, soft in the middle, served warm with vanilla ice cream.',
        ingredients: ['Flour', 'Butter', 'Chocolate chips', 'Vanilla ice cream'],
      },
      'Brownie Ala Mode': {
        desc: 'Warm, fudgy brownie served with a scoop of vanilla ice cream.',
        ingredients: ['Brownie', 'Vanilla ice cream'],
      },
      'Apple Turnover': {
        desc: 'Flaky pastry filled with warm spiced apples, served with vanilla ice cream.',
        ingredients: ['Puff pastry', 'Spiced apple filling', 'Vanilla ice cream'],
      },
      'Chocolate Chip Cookie': {
        desc: 'Classic chocolate chip, soft in the middle with crisp edges.',
        ingredients: ['Flour', 'Butter', 'Chocolate chips', 'Sugar'],
      },
      'Matcha Cookie': {
        desc: 'Earthy matcha cookie with a delicate, tender crumb.',
        ingredients: ['Matcha powder', 'Flour', 'Butter', 'Sugar'],
      },
      'Red Velvet': {
        desc: 'Soft red velvet cookie with hints of cocoa.',
        ingredients: ['Flour', 'Butter', 'Cocoa', 'Red velvet coloring'],
      },
      'Double Chocolate Walnut': {
        desc: 'Rich double chocolate cookie loaded with crunchy walnuts.',
        ingredients: ['Flour', 'Chocolate', 'Walnuts', 'Butter'],
      },
      'Churros': {
        desc: 'Crispy fried dough dusted with cinnamon sugar.',
        ingredients: ['Choux dough', 'Cinnamon sugar'],
      },
      'Cheese Roll': {
        desc: 'Soft bread roll filled with sweet, melty cheese.',
        ingredients: ['Bread dough', 'Cheese filling'],
      },
      'Pain Au Chocolat': {
        desc: 'Buttery, flaky pastry wrapped around rich chocolate.',
        ingredients: ['Puff pastry', 'Chocolate batons', 'Butter'],
      },
      'Cinnamon Roll': {
        desc: 'Soft, swirled roll glazed with sweet cinnamon icing.',
        ingredients: ['Dough', 'Cinnamon', 'Butter', 'Icing glaze'],
      },
      'Choco Crinkles': {
        desc: 'Fudgy chocolate cookies dusted with powdered sugar.',
        ingredients: ['Cocoa', 'Flour', 'Powdered sugar', 'Butter'],
      },
      'Chicken Wings': {
        desc: 'Crispy fried wings tossed in your choice of flavor, with an optional dip on the side.',
        ingredients: ['Chicken wings', 'Breading', 'Choice of sauce'],
      },
      'Chicken Tonkatsu': {
        desc: 'Breaded, deep-fried chicken cutlet with a crunchy golden crust.',
        ingredients: ['Chicken cutlet', 'Panko breading', 'Tonkatsu sauce'],
      },
      'Loaded Burger Steak': {
        desc: 'Juicy burger patty smothered in mushroom gravy and toppings.',
        ingredients: ['Beef patty', 'Mushroom gravy', 'Cheese', 'Onions'],
      },
      'Chicken Alfredo': {
        desc: 'Creamy alfredo pasta tossed with grilled chicken, served with garlic bread.',
        ingredients: ['Pasta', 'Chicken', 'Alfredo sauce', 'Parmesan'],
      },
      'Shrimp Scampi': {
        desc: 'Garlicky butter shrimp pasta, light and savory, served with garlic bread.',
        ingredients: ['Pasta', 'Shrimp', 'Garlic butter sauce'],
      },
      'Tuna Pasta': {
        desc: 'Tuna tossed in a light tomato sauce over pasta, served with garlic bread.',
        ingredients: ['Pasta', 'Tuna', 'Tomato sauce'],
      },
      'Penne Marinara': {
        desc: 'Classic penne in a rich marinara sauce, served with garlic bread.',
        ingredients: ['Penne pasta', 'Marinara sauce', 'Herbs'],
      },
      'Katsu Burger': {
        desc: 'Crispy chicken katsu patty stacked in a soft burger bun.',
        ingredients: ['Chicken katsu patty', 'Burger bun', 'Katsu sauce'],
      },
      'Beef Burger': {
        desc: 'A hearty beef patty burger with all the classic fixings.',
        ingredients: ['Beef patty', 'Burger bun', 'Lettuce', 'Tomato'],
      },
      'Egg Hashbrown': {
        desc: 'Crispy hashbrown and egg sandwiched between toasted bread.',
        ingredients: ['Hashbrown', 'Egg', 'Toasted bread'],
      },
      'Grilled Cheese': {
        desc: 'Golden, buttery toasted bread with melted cheese inside.',
        ingredients: ['Bread', 'Cheese', 'Butter'],
      },
      'Tuna Melt': {
        desc: 'Tuna salad and melted cheese grilled between toasted bread.',
        ingredients: ['Tuna', 'Cheese', 'Toasted bread'],
      },
      'Parker Rolls': {
        desc: 'Soft dinner rolls served warm, great for sharing.',
        ingredients: ['Dough', 'Butter'],
      },
      'French Fries': {
        desc: 'Crispy golden fries tossed in your choice of flavor.',
        ingredients: ['Potatoes', 'Choice of seasoning'],
      },
      'Cheesy Nachos': {
        desc: 'Crunchy tortilla chips loaded with melted cheese and your choice of add-ons.',
        ingredients: ['Tortilla chips', 'Cheese sauce'],
      },
      'Quesadilla': {
        desc: 'Grilled tortilla folded over melted cheese, crisp and gooey.',
        ingredients: ['Tortilla', 'Cheese', 'Grilled fillings'],
      },
      'Bacon Cheese Fries': {
        desc: 'Crispy fries loaded with melted cheese and crumbled bacon.',
        ingredients: ['Potatoes', 'Cheese sauce', 'Bacon bits'],
      },
    };

    // ===== Menu search: filter every product across every category =====
    const menuSearch = document.getElementById('menuSearch');
    const menuSearchClear = document.getElementById('menuSearchClear');
    const menuSearchCount = document.getElementById('menuSearchCount');
    const searchableProducts = Array.from(document.querySelectorAll('main .product-grid li.product-row[data-item-name]'));

    function normalizeSearch(value) {
      return value.toLowerCase().trim().replace(/\s+/g, ' ');
    }

    function updateMenuSearch() {
      const query = normalizeSearch(menuSearch.value);
      let visibleCount = 0;

      searchableProducts.forEach((row) => {
        const name = row.dataset.itemName || '';
        const info = PRODUCT_INFO[name] || {};
        const searchableText = normalizeSearch([name, info.desc || '', ...(info.ingredients || [])].join(' '));
        const matches = !query || searchableText.includes(query);
        row.classList.toggle('search-hidden', !matches);
        if (matches) visibleCount += 1;
      });

      document.querySelectorAll('main section.panel[id]').forEach((section) => {
        if (!['coffee', 'soda', 'tea', 'pastries', 'food-menu'].includes(section.id)) return;
        const products = Array.from(section.querySelectorAll('li.product-row[data-item-name]'));
        const hasVisibleProduct = products.some((row) => !row.classList.contains('search-hidden'));
        section.classList.toggle('search-empty-section', Boolean(query) && !hasVisibleProduct);
      });

      if (!query) {
        menuSearchCount.textContent = `${searchableProducts.length} items`;
      } else if (visibleCount === 0) {
        menuSearchCount.textContent = 'No matches';
      } else {
        menuSearchCount.textContent = `${visibleCount} ${visibleCount === 1 ? 'item' : 'items'} found`;
      }

      menuSearchClear.hidden = !query;
    }

    menuSearch.addEventListener('input', updateMenuSearch);
    menuSearchClear.addEventListener('click', () => {
      menuSearch.value = '';
      updateMenuSearch();
      menuSearch.focus();
    });
    
        // Keep the sticky search bar aligned under the mobile top bar and category chips
    (function () {
      const root = document.documentElement.style;
      const measure = () => {
        const mobile = window.matchMedia('(max-width: 991px)').matches;
        const bar = document.getElementById('mobileTopbar');
        const nav = document.querySelector('.mobile-category-nav');
        const search = document.querySelector('.menu-search-section');
        root.setProperty('--topbar-h', mobile && bar ? bar.offsetHeight + 'px' : '0px');
        root.setProperty('--catnav-h', mobile && nav ? nav.offsetHeight + 'px' : '0px');
        root.setProperty('--search-h', search ? search.offsetHeight + 'px' : '96px');
      };
      window.addEventListener('resize', measure);
      window.addEventListener('load', measure);
      measure();
    })();

    // Reveal product cards smoothly as the customer scrolls through the menu.
    if ('IntersectionObserver' in window) {
      const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const row = entry.target;
          const index = searchableProducts.indexOf(row);
          row.style.setProperty('--reveal-delay', `${Math.min(Math.max(index, 0), 7) * 45}ms`);
          row.classList.add('menu-reveal');
          observer.unobserve(row);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

      searchableProducts.forEach((row) => revealObserver.observe(row));
    } else {
      searchableProducts.forEach((row) => row.classList.add('menu-reveal'));
    }

    // ===== Product detail modal: click/tap any menu item to bring it to the front =====
    const productDetailOverlay = document.getElementById('productDetailOverlay');
    const productDetailModal = document.getElementById('productDetailModal');
    const productDetailClose = document.getElementById('productDetailClose');
    const detailProductImage = document.getElementById('detailProductImage');
    const detailProductName = document.getElementById('detailProductName');
    const detailProductPrice = document.getElementById('detailProductPrice');
    const detailProductDescription = document.getElementById('detailProductDescription');
    const detailFlavorChips = document.getElementById('detailFlavorChips');
    const detailSizeSelect = document.getElementById('detailSizeSelect');
    const detailExtraOptions = document.getElementById('detailExtraOptions');
    const detailQtyInput = document.getElementById('detailQtyInput');
    const detailQtyMinus = document.getElementById('detailQtyMinus');
    const detailQtyPlus = document.getElementById('detailQtyPlus');
    const detailTotal = document.getElementById('detailTotal');
    const productDetailAdd = document.getElementById('productDetailAdd');

    const FLAVOR_NOTES = {
      'Cafe Americano': ['Bold & Rich', 'Smooth Body', 'Slightly Bitter'],
      'Espresso': ['Intense', 'Roasty', 'Rich'],
      'Double Espresso': ['Extra Bold', 'Strong', 'Deep Roast'],
      'Cafe Latte': ['Creamy', 'Milky', 'Smooth'],
      'Mocha Latte': ['Chocolatey', 'Sweet', 'Creamy'],
      'Cappuccino': ['Bold', 'Velvety Foam', 'Balanced'],
      'Caramel Macchiato': ['Caramel', 'Vanilla', 'Sweet'],
      'English Toffee': ['Buttery', 'Toffee', 'Sweet'],
      'Matcha Latte': ['Earthy', 'Creamy', 'Mellow'],
      'Matcha Caramel': ['Earthy', 'Caramel', 'Sweet'],
      'Hazelnut': ['Nutty', 'Creamy', 'Aromatic'],
      'Macadamia': ['Buttery', 'Nutty', 'Smooth'],
      'Roasted Almond': ['Toasty', 'Nutty', 'Smooth'],
      'Hot Bellagio Chocolate': ['Rich Cocoa', 'Chocolatey', 'Silky'],
      'Barista Drink': ['Signature', 'Balanced', 'Aromatic'],
      'Dirty Matcha': ['Earthy', 'Bold Coffee', 'Creamy'],
      'Salted Caramel': ['Caramel', 'Sweet', 'Lightly Salty'],
      'Dark Chocolate': ['Dark Cocoa', 'Rich', 'Bittersweet'],
      'Biscoff Latte': ['Spiced', 'Caramelized', 'Creamy'],
      'Cookies & Cream': ['Creamy', 'Chocolate Cookie', 'Sweet'],
      'Matcha': ['Earthy', 'Cool', 'Creamy'],
      'Double Chocolate': ['Chocolatey', 'Rich', 'Creamy'],
      'Vanilla Bean Hazelnut': ['Vanilla', 'Nutty', 'Creamy'],
      'Strawberry': ['Fruity', 'Sweet', 'Creamy'],
      'Mocha Crumble': ['Mocha', 'Chocolatey', 'Crunchy'],
      'Mocha Frappe': ['Chocolatey', 'Creamy', 'Coffee-Rich'],
      'Butterscotch': ['Buttery', 'Caramel', 'Sweet'],
    };

    let activeProductRow = null;
    let detailLastFocused = null;

    function getFlavorNotes(name, info) {
      if (FLAVOR_NOTES[name]) return FLAVOR_NOTES[name];
      const source = (info?.ingredients || [])
        .map((item) => item.replace(/\b(syrup|powder|milk|water|ice|sauce)\b/gi, '').trim())
        .filter(Boolean);
      return source.slice(0, 3).length ? source.slice(0, 3) : ['Fresh', 'Made to order', 'House favorite'];
    }

    function getDetailAddonPrice() {
      let total = 0;
      detailExtraOptions.querySelectorAll('input[type=\"checkbox\"]:checked').forEach((input) => {
        const price = Number.parseFloat(input.dataset.price || '0');
        if (Number.isFinite(price)) total += price;
      });
      return total;
    }

    function syncDetailPrice() {
      if (!activeProductRow) return;
      const option = detailSizeSelect.options[detailSizeSelect.selectedIndex];
      const basePrice = Number.parseFloat(option?.dataset.price || 'NaN');
      const addonPrice = getDetailAddonPrice();
      const unitPrice = basePrice + addonPrice;
      const qty = clampQty(detailQtyInput.value) || 1;
      const unavailable = !Number.isFinite(basePrice);

      detailProductPrice.textContent = unavailable ? 'Price unavailable' : formatPeso(unitPrice);
      detailTotal.textContent = unavailable ? '—' : formatPeso(unitPrice * qty);
      productDetailAdd.disabled = unavailable;
      productDetailAdd.classList.toggle('is-unavailable', unavailable);
    }

    function renderDetailExtras(row) {
      detailExtraOptions.innerHTML = '';
      const groups = [...row.querySelectorAll('.temp-options, .serving-options, .addon-options')];
      if (!groups.length) return;

      groups.forEach((group, groupIndex) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'detail-extra-group';
        const label = document.createElement('span');
        label.className = 'detail-section-label';
        label.textContent = group.querySelector('legend')?.textContent || (group.classList.contains('addon-options') ? 'OPTIONS' : 'CHOICE');
        wrapper.appendChild(label);

        const options = document.createElement('div');
        options.className = 'detail-option-pills';
        group.querySelectorAll('label').forEach((originalLabel) => {
          const originalInput = originalLabel.querySelector('input');
          if (!originalInput) return;
          const pill = document.createElement('label');
          pill.className = 'detail-option-pill';
          const input = document.createElement('input');
          input.type = originalInput.type;
          input.name = `detail-extra-${groupIndex}`;
          input.value = originalInput.value;
          input.checked = originalInput.checked;
          if (originalInput.dataset.price) input.dataset.price = originalInput.dataset.price;
          const text = document.createElement('span');
          text.textContent = originalLabel.textContent.trim();
          pill.append(input, text);
          options.appendChild(pill);
        });
        wrapper.appendChild(options);
        detailExtraOptions.appendChild(wrapper);
      });
    }

    function openProductDetail(row) {
      activeProductRow = row;
      detailLastFocused = document.activeElement;
      const name = row.dataset.itemName || 'Coffee';
      const info = PRODUCT_INFO[name] || { desc: 'A café favorite, made fresh to order.', ingredients: [] };
      const sourceImg = row.querySelector('.product-icon-wrap img');

      const section = row.closest('section');
      const categoryNames = {
        coffee: 'COFFEE',
        soda: 'ITALIAN SODA',
        tea: 'TEA',
        pastries: 'PASTRIES',
        'food-menu': 'FOOD MENU'
      };
      const category = categoryNames[section?.id] || 'MENU';

      detailProductName.textContent = name;
      detailProductImage.src = sourceImg?.getAttribute('src') || '';
      detailProductImage.alt = name;
      document.getElementById('detailProductCategory').textContent = category;
      detailProductDescription.textContent = info.desc;
      detailFlavorChips.innerHTML = getFlavorNotes(name, info).map((note) => `<span class="flavor-chip">${note}</span>`).join('');

      const sourceSelect = row.querySelector('.size-select');
      detailSizeSelect.innerHTML = sourceSelect ? sourceSelect.innerHTML : '';
      if (sourceSelect) detailSizeSelect.value = sourceSelect.value;

      renderDetailExtras(row);
      detailQtyInput.value = '1';
      syncDetailPrice();

      productDetailOverlay.classList.add('open');
      productDetailModal.classList.add('open');
      productDetailModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('detail-modal-open');
      productDetailClose.focus();
    }

    function closeProductDetail() {
      productDetailOverlay.classList.remove('open');
      productDetailModal.classList.remove('open');
      productDetailModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('detail-modal-open');
      activeProductRow = null;
      if (detailLastFocused && typeof detailLastFocused.focus === 'function') detailLastFocused.focus();
      detailLastFocused = null;
    }

    document.querySelectorAll('main .product-grid li.product-row[data-item-name]').forEach((row) => {
      row.addEventListener('click', (event) => {
        const interactive = event.target.closest('button, input, select, label, a');
        if (interactive && !interactive.classList.contains('product-name')) return;
        openProductDetail(row);
      });

      row.querySelector('.product-name')?.addEventListener('click', (event) => {
        event.stopPropagation();
        openProductDetail(row);
      });

      row.setAttribute('tabindex', '0');
      row.setAttribute('role', 'button');
      row.addEventListener('keydown', (event) => {
        if ((event.key === 'Enter' || event.key === ' ') && event.target === row) {
          event.preventDefault();
          openProductDetail(row);
        }
      });
    });

    detailSizeSelect.addEventListener('change', syncDetailPrice);
    detailExtraOptions.addEventListener('change', syncDetailPrice);

    detailQtyMinus.addEventListener('click', () => {
      detailQtyInput.value = Math.max(1, clampQty(detailQtyInput.value) - 1);
      syncDetailPrice();
    });

    detailQtyPlus.addEventListener('click', () => {
      detailQtyInput.value = Math.min(20, clampQty(detailQtyInput.value) + 1);
      syncDetailPrice();
    });

    detailQtyInput.addEventListener('input', () => {
      let qty = clampQty(detailQtyInput.value);
      if (qty < 1) qty = 1;
      detailQtyInput.value = qty;
      syncDetailPrice();
    });

    productDetailAdd.addEventListener('click', () => {
      if (!activeProductRow || productDetailAdd.disabled) return;

      const option = detailSizeSelect.options[detailSizeSelect.selectedIndex];
      const basePrice = parseFloat(option?.dataset.price || 'NaN');
      const qty = Math.min(20, Math.max(1, clampQty(detailQtyInput.value)));
      if (Number.isNaN(basePrice)) return;

      const sourceSelect = activeProductRow.querySelector('.size-select');
      if (sourceSelect) sourceSelect.value = detailSizeSelect.value;

      const sourceGroups = activeProductRow.querySelectorAll('.temp-options, .serving-options, .addon-options');
      const detailGroups = detailExtraOptions.querySelectorAll('.detail-extra-group');
      detailGroups.forEach((detailGroup, index) => {
        const sourceGroup = sourceGroups[index];
        if (!sourceGroup) return;
        const chosen = detailGroup.querySelectorAll('input:checked');
        const sourceInputs = sourceGroup.querySelectorAll('input');
        chosen.forEach((detailInput) => {
          const sourceInput = Array.from(sourceInputs).find((input) => input.value === detailInput.value && input.type === detailInput.type);
          if (sourceInput) sourceInput.checked = true;
        });
      });

      let addonPrice = 0;
      const addonLabels = [];
      activeProductRow.querySelectorAll('.addon-options').forEach((fieldset) => {
        fieldset.querySelectorAll('input[type="checkbox"]:checked').forEach((box) => {
          const p = parseFloat(box.dataset.price);
          if (!Number.isNaN(p)) addonPrice += p;
          const labelEl = box.closest('label');
          addonLabels.push(labelEl ? labelEl.textContent.trim() : box.value);
        });
        const checkedRadio = fieldset.querySelector('input[type="radio"]:checked');
        if (checkedRadio) {
          const labelEl = checkedRadio.closest('label');
          addonLabels.push(labelEl ? labelEl.textContent.trim() : checkedRadio.value);
        }
      });

      let servingLabel = null;
      const servingGroup = activeProductRow.querySelector('.serving-options, .temp-options');
      const checked = servingGroup?.querySelector('input[type="radio"]:checked');
      if (checked) {
        const labelEl = checked.closest('label');
        servingLabel = labelEl ? labelEl.textContent.trim() : checked.value;
      }

      const itemName = activeProductRow.dataset.itemName;
      const size = option.value || 'Regular';
      const price = basePrice + addonPrice;
      const descriptors = [servingLabel, ...addonLabels].filter(Boolean);
      const entryKey = descriptors.length ? `${itemName} — ${descriptors.join(', ')}` : itemName;
      const itemImage = activeProductRow.querySelector('img')?.getAttribute('src') || '';
      const itemId = activeProductRow.dataset.itemId;
      const existing = cart.find((entry) => entry.name === entryKey && entry.size === size);

      if (existing) existing.qty += qty;
      else cart.push({ id: itemId, name: entryKey, size, price, qty, image: itemImage });

      renderCart();
      productDetailAdd.textContent = 'Added to Cart ✓';
      productDetailAdd.classList.add('is-added');
      setTimeout(() => {
        productDetailAdd.textContent = '🛒 ADD TO CART';
        productDetailAdd.classList.remove('is-added');
        closeProductDetail();
      }, 650);
    });

    productDetailClose.addEventListener('click', closeProductDetail);
    productDetailOverlay.addEventListener('click', closeProductDetail);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && productDetailModal.classList.contains('open')) closeProductDetail();
    });
    // ===== Cart system =====
    const cart = []; // { name, size, price, qty }

    function formatPeso(amount) {
      return '₱' + amount.toLocaleString('en-PH');
    }

    function updateCartCount() {
      const totalQty = cart.reduce((sum, entry) => sum + entry.qty, 0);
      const cartCount = document.querySelector('.cart-count');
      const mobileCount = document.getElementById('mobileCartCount');
      if (cartCount) cartCount.textContent = String(totalQty);
      if (mobileCount) mobileCount.textContent = String(totalQty);
    }

    function getCartImage(entry) {
      if (entry.image) return entry.image;

      const baseName = entry.name.split(' — ')[0].trim();
      const row = document.querySelector(`main .product-grid li.product-row[data-item-name="${CSS.escape(baseName)}"]`);
      return row?.querySelector('img')?.getAttribute('src') || '';
    }

    function renderCart() {
      const list = document.getElementById('cartItemsList');
      const totalEl = document.getElementById('cartTotal');
      list.innerHTML = '';

      if (cart.length === 0) {
        list.innerHTML = '<li class="cart-empty">Your cart is empty</li>';
        totalEl.textContent = formatPeso(0);
        updateCartCount();
        return;
      }

      let total = 0;
      cart.forEach((entry, index) => {
        const lineTotal = entry.price * entry.qty;
        total += lineTotal;

        const li = document.createElement('li');
        li.className = 'cart-line';
        const image = getCartImage(entry);
        li.innerHTML = `
          <div class="cart-line-image">
            ${image ? `<img src="${image}" alt="${entry.name.split(' — ')[0].trim()}" loading="lazy">` : ''}
          </div>
          <div class="cart-line-info">
            <span class="cart-line-name">${entry.name}</span>
            <span class="cart-line-meta">${entry.size} · qty ${entry.qty}</span>
          </div>
          <div class="cart-line-right">
            <span class="cart-line-price">${formatPeso(lineTotal)}</span>
            <button type="button" class="cart-line-remove" data-index="${index}" aria-label="Remove ${entry.name}">×</button>
          </div>
        `;
        list.appendChild(li);
      });

      totalEl.textContent = formatPeso(total);
      updateCartCount();

      list.querySelectorAll('.cart-line-remove').forEach((removeBtn) => {
        removeBtn.addEventListener('click', () => {
          cart.splice(Number(removeBtn.dataset.index), 1);
          renderCart();
        });
      });
    }

    function clampQty(value) {
      let val = parseInt(value, 10);
      if (isNaN(val) || val < 0) val = 0;
      if (val > 20) val = 20;
      return val;
    }

    document.querySelectorAll('.qty-stepper').forEach((stepper) => {
      const minusBtn = stepper.querySelector('.qty-minus');
      const plusBtn = stepper.querySelector('.qty-plus');
      const qtyInput = stepper.querySelector('.qty-input');

      minusBtn.addEventListener('click', () => {
        qtyInput.value = clampQty(qtyInput.value) - 1;
      });

      plusBtn.addEventListener('click', () => {
        qtyInput.value = clampQty(qtyInput.value) + 1;
      });

      qtyInput.addEventListener('change', () => {
        qtyInput.value = clampQty(qtyInput.value);
      });
    });


    // Generalized to price up: base size price + any checked add-on prices, and to
    // label the cart line with whatever serving/flavor choice the shopper made.
    document.querySelectorAll('.category-add-btn').forEach((catBtn) => {
      catBtn.addEventListener('click', () => {
        const list = document.getElementById(catBtn.dataset.target);
        const items = list.querySelectorAll('li.product-row[data-item-name]');

        let addedCount = 0;
        let hadUnavailable = false;

        items.forEach((li) => {
          const itemName = li.dataset.itemName;
          const itemId = li.dataset.itemId;

          const select = li.querySelector('.size-select');
          const stepper = li.querySelector('.qty-stepper');
          if (!select || !stepper) return;

          const qtyInput = stepper.querySelector('.qty-input');
          const qty = clampQty(qtyInput.value);
          if (qty <= 0) return;

          const option = select.options[select.selectedIndex];
          if (!option) {
            hadUnavailable = true;
            return;
          }
          const basePrice = parseFloat(option.dataset.price);

          if (!option.dataset.price || isNaN(basePrice)) {
            hadUnavailable = true;
            return;
          }

          const size = option.hasAttribute('value') ? option.value : 'Regular';

          // Serving-style single choice (e.g. Hot/Iced, wings flavor) — no price change, just a label.
          let servingLabel = null;
          const servingGroup = li.querySelector('.serving-options');
          if (servingGroup) {
            const checkedRadio = servingGroup.querySelector('input[type="radio"]:checked');
            if (checkedRadio) {
              const labelEl = checkedRadio.closest('label');
              servingLabel = labelEl ? labelEl.textContent.trim() : checkedRadio.value;
            }
          }

          // Add-on groups: checkboxes add to price, radios (e.g. fries flavor) just describe a choice.
          let addonPrice = 0;
          const addonLabels = [];
          li.querySelectorAll('.addon-options').forEach((fieldset) => {
            fieldset.querySelectorAll('input[type="checkbox"]:checked').forEach((box) => {
              const p = parseFloat(box.dataset.price);
              if (!isNaN(p)) addonPrice += p;
              const labelEl = box.closest('label');
              addonLabels.push(labelEl ? labelEl.textContent.trim() : box.value);
            });

            const checkedRadio = fieldset.querySelector('input[type="radio"]:checked');
            if (checkedRadio) {
              const labelEl = checkedRadio.closest('label');
              addonLabels.push(labelEl ? labelEl.textContent.trim() : checkedRadio.value);
            }
          });

          const price = basePrice + addonPrice;
          const descriptors = [servingLabel, ...addonLabels].filter(Boolean);
          const entryKey = descriptors.length ? `${itemName} — ${descriptors.join(', ')}` : itemName;
          const itemImage = li.querySelector('img')?.getAttribute('src') || '';

          const existing = cart.find((entry) => entry.name === entryKey && entry.size === size);
          if (existing) {
            existing.qty += qty;
          } else {
            cart.push({ id: itemId, name: entryKey, size, price, qty, image: itemImage });
          }

          addedCount += qty;
          qtyInput.value = 0;
        });

        if (addedCount > 0) {
          renderCart();
          const original = catBtn.textContent;
          catBtn.textContent = 'Added to Cart ✓';
          catBtn.classList.add('is-flash');
          setTimeout(() => {
            catBtn.textContent = original;
            catBtn.classList.remove('is-flash');
          }, 1100);
        } else {
          const original = catBtn.textContent;
          catBtn.textContent = hadUnavailable ? 'Item unavailable' : 'Set a quantity first';
          setTimeout(() => { catBtn.textContent = original; }, 1300);
        }
      });
    });

    // ===== Cart panel and checkout modal =====
    const checkoutModal = document.getElementById('checkoutModal');
    const checkoutOverlay = document.getElementById('checkoutOverlay');

    const cartBtn = document.getElementById('cartBtn');
    const cartPanel = document.getElementById('cartPanel');
    const cartOverlay = document.getElementById('cartOverlay');
    const cartClose = document.getElementById('cartClose');
    const cartCheckout = document.getElementById('cartCheckout');

    function openCart() {
      cartPanel.classList.add('open');
      cartOverlay.classList.add('open');
      cartPanel.setAttribute('aria-hidden', 'false');
    }

    function closeCart() {
      cartPanel.classList.remove('open');
      cartOverlay.classList.remove('open');
      cartPanel.setAttribute('aria-hidden', 'true');
    }

    function openCheckoutModal() {
      checkoutModal.classList.add('open');
      checkoutOverlay.classList.add('open');
      checkoutModal.setAttribute('aria-hidden', 'false');
    }
    function closeCheckoutModal() {
      checkoutModal.classList.remove('open');
      checkoutOverlay.classList.remove('open');
      checkoutModal.setAttribute('aria-hidden', 'true');
    }

    const mobileCartButton = document.getElementById('mobileCartButton');
    if (mobileCartButton) {
      mobileCartButton.addEventListener('click', openCart);
    }

    cartBtn.addEventListener('click', openCart);
    cartClose.addEventListener('click', closeCart);
    cartOverlay.addEventListener('click', closeCart);

cartCheckout.addEventListener('click', async () => {
  if (cart.length === 0) return;

  const receiverName = sessionStorage.getItem('cs_receiver_name');
  if (!receiverName) {
    closeCart();
    orderStartOverlay.classList.remove('is-hidden');
    document.body.classList.add('order-setup-active');
    return;
  }

  // 1. Build the payload using YOUR actual user inputs
  const orderPayload = {
    receiverName: receiverName,
    type: orderMethod === 'delivery' ? 'delivery' : 'pickup', 
    payPref: 'cash', 
    note: deliveryAddress?.notes || '',
    address: orderMethod === 'delivery' ? deliveryAddress : null,
    
    // 2. Map the cart (WITH THE TEMPORARY HARDCODED ID)
    items: cart.map((entry) => {
      return {
        menuItemId: Number(entry.id),
        name: entry.name.split(' — ')[0].trim(),
        size: entry.size,
        qty: entry.qty,
        options: [] // We will wire up add-on options later!
      };
    })
  };

  try {
    // 3. Send to the Express server
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to place order');
    }
    
    // 4. Success!
    console.log("Order saved to SQLite:", data);
    
    cart.length = 0;
    renderCart();
    closeCart();
    openCheckoutModal(); 

  } catch (err) {
    alert("Order Failed: " + err.message);
    console.error(err);
  }
});

    document.getElementById('checkoutModalClose').addEventListener('click', closeCheckoutModal);
    checkoutOverlay.addEventListener('click', closeCheckoutModal);

    renderCart();

(() => {
  const fallbackDescription = 'Freshly prepared at Coffee Spot with a balanced flavor made for an easy, satisfying treat.';
  const info = (typeof PRODUCT_INFO !== 'undefined') ? PRODUCT_INFO : {};

  document.querySelectorAll('.product-grid .product-row[data-item-name]').forEach((card) => {
    const name = card.dataset.itemName || '';
    const details = card.querySelector('.product-details');
    const title = card.querySelector('.product-name');
    if (!details || !title || details.querySelector('.product-card-description')) return;

    const description = info[name]?.desc || fallbackDescription;
    const desc = document.createElement('p');
    desc.className = 'product-card-description';
    desc.textContent = description;

    const hint = document.createElement('span');
    hint.className = 'product-card-hint';
    hint.innerHTML = '<span aria-hidden="true">✦</span> Tap for details & order';

    title.insertAdjacentElement('afterend', desc);
    details.appendChild(hint);
  });
})();

/* ===== ADD-ON ONLY: Coffee Spot Hero Showcase ===== */
(function(){
  function initCoffeeSpotHeroShowcase(){
    const hero = document.getElementById('home');
    if (!hero || hero.querySelector('.cs-hero-showcase-addon')) return;

    const picks = [
      {
        name:'Cafe Latte',
        kicker:'Coffee favorite',
        image:'image/Cafe Latte.jpg.jpeg',
        desc:'Espresso balanced with steamed milk for a creamy, comforting sip.'
      },
      {
        name:'Mocha Latte',
        kicker:'Coffee favorite',
        image:'image/WO7ZFQHYNS2FISSKD76GW2UC.jpg',
        desc:'Espresso and chocolate blended with steamed milk for a sweet coffee treat.'
      },
      {
        name:'Cappuccino',
        kicker:'Coffee favorite',
        image:'image/how-to-make-cappuccino-005.jpg',
        desc:'Equal parts espresso, steamed milk, and velvety foam.'
      }
    ];

    const storageKey = 'coffeeSpotHeroShowcaseStart';
    let current = 0;
    let timer = null;

    const safeText = value => String(value).replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));

    let previous = 0;
    try {
      previous = Number.parseInt(window.localStorage.getItem(storageKey) || '0', 10);
    } catch {
      previous = 0;
    }
    current = Number.isFinite(previous) ? ((previous % picks.length) + picks.length) % picks.length : 0;
    try {
      window.localStorage.setItem(storageKey, String((current + 1) % picks.length));
    } catch {
      // Storage can be blocked; the showcase still works without rotation persistence.
    }

    const addon = document.createElement('div');
    addon.className = 'cs-hero-showcase-addon';
    addon.innerHTML = `
      <div class="cs-hero-showcase-inner">
        <div class="cs-hero-showcase-copy">
          <div class="cs-hero-showcase-eyebrow"><i></i> COFFEE SPOT</div>
          <h1>Great coffee,<br><em>great days.</em></h1>
          <p>Handcrafted drinks, good food, and cozy vibes — made for you.</p>
          <button type="button" class="cs-hero-showcase-cta">Explore Our Menu <span aria-hidden="true">›</span></button>
          <div class="cs-hero-showcase-proof">
            <div class="cs-hero-showcase-avatars" aria-hidden="true">
              <span>CS</span><span>♥</span><span>☕</span>
            </div>
            <span>Loved by our customers<br>and coffee lovers.</span>
          </div>
        </div>

        <div class="cs-hero-showcase-card" aria-label="Featured coffee picks">
          <div class="cs-hero-showcase-card-head">
            <small><span class="cs-hero-showcase-dot" aria-hidden="true">●</span> Featured Picks</small>
            <span class="cs-hero-showcase-count" aria-live="polite">1 / 3</span>
          </div>
          <div class="cs-hero-showcase-track-wrap">
            <div class="cs-hero-showcase-track"></div>
          </div>
          <div class="cs-hero-showcase-card-foot">
            <div class="cs-hero-showcase-bullets" role="tablist" aria-label="Choose featured coffee"></div>
            <span class="cs-hero-showcase-hint">Swipe or tap a bullet</span>
          </div>
        </div>
      </div>
    `;

    const track = addon.querySelector('.cs-hero-showcase-track');
    const bullets = addon.querySelector('.cs-hero-showcase-bullets');
    const count = addon.querySelector('.cs-hero-showcase-count');

    picks.forEach((item,index)=>{
      const slide = document.createElement('article');
      slide.className = 'cs-hero-showcase-slide';
      slide.innerHTML = `
        <img class="cs-hero-showcase-image" src="${safeText(item.image)}" alt="${safeText(item.name)}">
        <div class="cs-hero-showcase-slide-copy">
          <span class="kicker">${safeText(item.kicker)}</span>
          <h2>${safeText(item.name)}</h2>
          <p>${safeText(item.desc)}</p>
          <button type="button" class="cs-hero-showcase-view">View &amp; Order <span aria-hidden="true">→</span></button>
        </div>
      `;
      slide.querySelector('.cs-hero-showcase-view').addEventListener('click',()=>{
        const row = Array.from(document.querySelectorAll('main .product-grid li.product-row[data-item-name]'))
          .find(el => el.dataset.itemName === item.name);
        if (!row) return;
        document.getElementById('coffee')?.scrollIntoView({behavior:'smooth',block:'start'});
        window.setTimeout(()=>row.click(),500);
      });
      track.appendChild(slide);

      const bullet = document.createElement('button');
      bullet.type = 'button';
      bullet.className = 'cs-hero-showcase-bullet';
      bullet.setAttribute('role','tab');
      bullet.setAttribute('aria-label',`Show ${item.name}`);
      bullet.addEventListener('click',()=>{
        goTo(index,true);
        restart();
      });
      bullets.appendChild(bullet);
    });

    addon.querySelector('.cs-hero-showcase-cta').addEventListener('click',()=>{
      document.getElementById('coffee')?.scrollIntoView({behavior:'smooth',block:'start'});
    });

    hero.appendChild(addon);

    function goTo(index, animate){
      current = (index + picks.length) % picks.length;
      track.style.transition = animate ? 'transform .65s var(--ease)' : 'none';
      track.style.transform = `translate3d(-${current*100}%,0,0)`;
      count.textContent = `${current+1} / ${picks.length}`;
      Array.from(bullets.children).forEach((bullet,i)=>{
        const active = i === current;
        bullet.classList.toggle('is-active',active);
        bullet.setAttribute('aria-selected',String(active));
        bullet.tabIndex = active ? 0 : -1;
      });
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function start(){
      window.clearInterval(timer);
      if (reduceMotion || document.hidden) return;
      timer = window.setInterval(()=>goTo(current+1,true),4500);
    }
    function stop(){
      window.clearInterval(timer);
      timer = null;
    }
    function restart(){ start(); }

    let touchStartX = 0;
    const viewport = addon.querySelector('.cs-hero-showcase-track-wrap');
    viewport.addEventListener('touchstart',event=>{
      touchStartX = event.changedTouches[0].clientX;
    },{passive:true});
    viewport.addEventListener('touchend',event=>{
      const delta = event.changedTouches[0].clientX - touchStartX;
      if (Math.abs(delta) < 40) return;
      goTo(current + (delta < 0 ? 1 : -1),true);
      restart();
    },{passive:true});

    addon.addEventListener('mouseenter', stop);
    addon.addEventListener('mouseleave', start);
    addon.addEventListener('focusin', stop);
    addon.addEventListener('focusout', (event)=>{
      if (!addon.contains(event.relatedTarget)) start();
    });

    document.addEventListener('visibilitychange',()=>{
      if (document.hidden) stop();
      else start();
    });

    goTo(current,false);
    start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',initCoffeeSpotHeroShowcase,{once:true});
  } else {
    initCoffeeSpotHeroShowcase();
  }
})();


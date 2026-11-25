import { ApiError, get, post } from "./api.js";

// Fills in the header: the account link and the number of items in the cart.
export const loadNav = async () => {
  const account = document.querySelector("[data-nav-account]");
  const count = document.querySelector("[data-cart-count]");
  try {
    const { user } = await get("/api/account/me");
    account.textContent = user.name.split(" ")[0];
    const { cart } = await get("/api/cart");
    setCartCount(cart.itemCount);
    return user;
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }
    account.textContent = "Sign in";
    count.hidden = true;
    return null;
  }
};

export const setCartCount = (itemCount) => {
  const count = document.querySelector("[data-cart-count]");
  count.textContent = String(itemCount);
  count.hidden = itemCount === 0;
};

export const signOut = async () => {
  await post("/api/account/logout");
  location.assign("/");
};

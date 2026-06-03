export const tvAppPageAccessCookieName = "xp_tv_app_page_access";
export const tvAppPageAccessCookieValue = "granted";

export function getTvAppPagePin() {
  return process.env.TV_APP_PAGE_PIN ?? "2400";
}

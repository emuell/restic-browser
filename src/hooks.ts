import { core } from "@tauri-apps/api";

// workaround for vaadin with vite
// see https://github.com/vaadin/vaadin-lumo-styles/issues/105
const oldDefine = customElements.define;
customElements.define = (
  name: string,
  construct: CustomElementConstructor,
  options?: ElementDefinitionOptions,
) => {
  try {
    return oldDefine.call(customElements, name, construct, options);
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.message.includes("has already been used with this registry")
    ) {
      return false;
    }
    throw error;
  }
};

// disable webview context menu
document.addEventListener(
  "contextmenu",
  (e) => {
    e.preventDefault();
    return false;
  },
  { capture: true },
);

// make window visible as soon as we got some content to show
document.addEventListener("DOMContentLoaded", () => {
  core.invoke<void>("show_app_window");
});

// workaround for vaadin with vite
// see https://github.com/vaadin/vaadin-lumo-styles/issues/105
const oldDefine = customElements.define;
customElements.define = function(name: string, constructor: CustomElementConstructor, options?: ElementDefinitionOptions) {
  try {
    return oldDefine.call(customElements, name, constructor, options);
  } catch (error) {
      if (
        error instanceof DOMException &&
        error.message.includes('has already been used with this registry')
      ) {
        return false;
      }
      throw error;
  }
}

export { }
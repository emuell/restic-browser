import { CSSResultGroup, css, html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';
import * as mobx from 'mobx';

import { columnBodyRenderer } from '@vaadin/grid/lit.js';
import { GridActiveItemChangedEvent } from '@vaadin/grid';

import { appState } from '../states/app-state';
import { LocationPreset } from '../states/location-preset';

import '@vaadin/vertical-layout';
import '@vaadin/grid';
import '@vaadin/button';

// -------------------------------------------------------------------------------------------------

/**
 * Location preset list, part of the location dialog.
 */

@customElement('restic-browser-location-presets')
export class ResticBrowserLocationPresets extends MobxLitElement {

  // invoken when a preset item got double-clicked
  @property()
  onDoubleClick!: (preset: LocationPreset) => void;

  @state()
  private _selectedItems: LocationPreset[] = [];

  private _selectedItemsClicked = new Set<LocationPreset>();

  constructor() {
    super();
    
    // set initial selection and update on changes
    mobx.autorun(() => {
      if (appState.selectedLocationPreset) {
        this._selectedItems = [appState.selectedLocationPreset];
      }
    });

    // bind this to all callbacks
    this._activeItemChanged = this._activeItemChanged.bind(this);
  }

  static override styles: CSSResultGroup = css`
    #layout {
      align-items: stretch; 
      width: 12rem; 
      height: 100%;
    }
    #grid {
      height: inherit;
    }
    vaadin-grid::part(header-cell) {
      font-size: var(--lumo-font-size-s);
      font-weight: 500;
      color: var(--lumo-secondary-text-color);
    }
  `;
  
  render() {
    return html`
      <vaadin-vertical-layout id="layout">
        <vaadin-grid id="grid" 
          theme="no-border no-row-borders compact"
          .items=${appState.locationPresets}
          .selectedItems=${this._selectedItems}
          @active-item-changed=${this._activeItemChanged}
        >
          <vaadin-grid-column
            path="name"
            header="Presets"
            .flexGrow=${1}
            ${columnBodyRenderer((item: LocationPreset, model, _column) => html`
              ${model.index != 0 
                ? html`<span>${item.name}</span>`
                : html`<i>${item.name}</i>`
              }`
            )}
          >
          </vaadin-grid-column>
          <vaadin-grid-column
            .frozenToEnd=${true}
            .autoWidth=${true}
            .flexGrow=${0}
            ${columnBodyRenderer((_item, model, _column) => html`
              ${model.index != 0 
                ? html`
                  <vaadin-button 
                    .tabindex=${null}
                    title="Delete preset" 
                    theme="small secondary icon" 
                    style="height: 1.5rem; margin: unset; padding: 0;"
                    @click=${() => {
                      appState.removeLocationPreset(model.index);
                    }}>
                      <vaadin-icon icon="vaadin:trash"></vaadin-icon>
                  </vaadin-button>`
                : nothing 
              }`
            )}
          >
          </vaadin-grid-column>
        </vaadin-grid>
      </vaadin-vertical-layout>
     `;
  }

  private _activeItemChanged(e: GridActiveItemChangedEvent<LocationPreset>) {
    const item = e.detail.value;
    // don't deselect selected items and make sure it's a valid item
    if (item && appState.locationPresets.includes(item)) {
      this._selectedItems = [ item ];
      appState.setSelectedLocationPreset(item);
    }
    // double-click handling
    const doubleClickItem = this._selectedItems.length ?
      this._selectedItems[0] : undefined;
    if (doubleClickItem) {
      if (this._selectedItemsClicked.has(doubleClickItem)) {
        this.onDoubleClick(doubleClickItem);
      }
      this._selectedItemsClicked.add(doubleClickItem);
      setTimeout(() => {
        this._selectedItemsClicked.delete(doubleClickItem);
      }, 500);
    }
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'restic-browser-location-presets': ResticBrowserLocationPresets,
  }
}

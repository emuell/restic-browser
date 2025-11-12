import { MobxLitElement } from "@adobe/lit-mobx";
import type {
  Grid,
  GridActiveItemChangedEvent,
  GridDragStartEvent,
  GridDropEvent,
} from "@vaadin/grid";
import { columnBodyRenderer } from "@vaadin/grid/lit.js";
import { type CSSResultGroup, css, html, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import * as mobx from "mobx";

import { appState } from "../states/app-state";
import type { LocationPreset } from "../states/location-preset";

import "@vaadin/vertical-layout";
import "@vaadin/grid";
import "@vaadin/button";

// -------------------------------------------------------------------------------------------------

/**
 * Location preset list, part of the location dialog.
 */

@customElement("restic-browser-location-presets")
export class ResticBrowserLocationPresets extends MobxLitElement {
  // invoked when a preset item got double-clicked
  @property()
  onDoubleClick!: (preset: LocationPreset) => void;

  private _selectedItemsClicked = new Set<LocationPreset>();

  @state()
  private _selectedItems: LocationPreset[] = [];
  @state()
  private _draggedItem: LocationPreset | undefined;

  @query("#grid")
  private _grid!: Grid<LocationPreset>;

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
    this._handleDragStart = this._handleDragStart.bind(this);
    this._handleDragEnd = this._handleDragEnd.bind(this);
    this._handleDrop = this._handleDrop.bind(this);
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
          rows-draggable
          .items=${appState.locationPresets}
          .selectedItems=${this._selectedItems}
          .dropMode=${this._draggedItem ? "between" : undefined}
          @active-item-changed=${this._activeItemChanged}
          @grid-dragstart=${this._handleDragStart}
          @grid-dragend=${this._handleDragEnd}
          @grid-drop=${this._handleDrop}
        >
          <vaadin-grid-column
            path="name"
            header="Presets"
            .flexGrow=${1}
            ${columnBodyRenderer(
              (item: LocationPreset, model, _column) => html`
              ${
                model.index !== 0
                  ? html`<span>${item.name}</span>`
                  : html`<i><b>${item.name}</b></i>`
              }`,
            )}
          >
          </vaadin-grid-column>
          <vaadin-grid-column
            .frozenToEnd=${true}
            .autoWidth=${true}
            .flexGrow=${0}
            ${columnBodyRenderer(
              (_item, model, _column) => html`
              ${
                model.index !== 0
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
              }`,
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
      this._selectedItems = [item];
      appState.setSelectedLocationPreset(item);
    }
    // double-click handling
    const doubleClickItem = this._selectedItems.length ? this._selectedItems[0] : undefined;
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

  private _handleDragStart(e: GridDragStartEvent<LocationPreset>) {
    const draggedItem = e.detail.draggedItems[0];
    // Don't allow moving the "New Location" item
    if (appState.locationPresets.indexOf(draggedItem) === 0) {
      e.preventDefault();
      return;
    }
    this._draggedItem = draggedItem;
    this._grid.dropMode = "between";
  }

  private _handleDragEnd() {
    this._draggedItem = undefined;
    this._grid.dropMode = undefined;
  }

  private _handleDrop(e: GridDropEvent<LocationPreset>) {
    const { dropTargetItem, dropLocation } = e.detail;
    // Only act when dropping on another item
    if (this._draggedItem && dropTargetItem !== this._draggedItem) {
      // Prevent dropping on the first item
      if (appState.locationPresets.indexOf(dropTargetItem) === 0) {
        e.preventDefault();
        return;
      }
      // Remove the item from its previous position
      const draggedItemIndex = appState.locationPresets.indexOf(this._draggedItem);
      appState.locationPresets.splice(draggedItemIndex, 1);
      // Re-insert the item at its new position
      const dropIndex =
        appState.locationPresets.indexOf(dropTargetItem) + (dropLocation === "below" ? 1 : 0);
      appState.locationPresets.splice(dropIndex, 0, this._draggedItem);
      // Re-assign the array to refresh the grid
      appState.locationPresets = [...appState.locationPresets];
    }
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    "restic-browser-location-presets": ResticBrowserLocationPresets;
  }
}

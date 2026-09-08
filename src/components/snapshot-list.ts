import { MobxLitElement } from "@adobe/lit-mobx";
import type {
  Grid,
  GridActiveItemChangedEvent,
  GridCellFocusEvent,
  GridColumn,
  GridHeaderFooterRenderer,
  GridItemModel,
} from "@vaadin/grid";
import { css, html, nothing, type PropertyValues, render } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import * as mobx from "mobx";

import type { restic } from "../backend/restic";
import { appState } from "../states/app-state";
import { formatDateTime } from "../utils/date-time";

import "./spinner";

import "@vaadin/button";
import "@vaadin/horizontal-layout";
import "@vaadin/grid";
import "@vaadin/grid/vaadin-grid-filter.js";
import "@vaadin/grid/vaadin-grid-sorter.js";
import "@vaadin/icon";
import "@vaadin/icons";
import "@vaadin/select";

// -------------------------------------------------------------------------------------------------

// Value of the "Show all" filter option: can't be empty, as `vaadin-select` then falls back to
// using the item's label as value.
const NO_FILTER_VALUE = String.fromCharCode(0);

// Month of a raw snapshot time, e.g. "2026-09": the grid filters substrings of the raw values.
function snapshotMonth(time: string): string {
  return time.slice(0, 7);
}

// -------------------------------------------------------------------------------------------------

// Snapshot list / table.

@customElement("restic-browser-snapshot-list")
export class ResticBrowserSnapshotList extends MobxLitElement {
  @state()
  private _selectedItems: restic.Snapshot[] = [];
  @state()
  private _showFilters: boolean = false;

  @query("#grid")
  private _grid!: Grid<restic.Snapshot> | null;
  private _recalculateColumnWidths: boolean = false;

  // selected filter value of each column: the grid does the filtering itself, this only is needed
  // to narrow down the offered values and to detect that the selected snapshot got filtered out
  private _filterValues: Map<string, string> = new Map();
  // re-renders the header cell content of each column, by column path
  private _headerUpdaters: Map<string, () => void> = new Map();
  // already rendered header cell contents, to detect newly created ones
  private _renderedHeaderRoots: WeakSet<HTMLElement> = new WeakSet();

  // header renderer identities must be stable: the grid wipes a header cell's content when the
  // renderer function changed
  private _shortIdHeaderRenderer = this._plainHeaderRenderer("short_id", "Short_id");
  private _timeHeaderRenderer = this._filterHeaderRenderer("time", "Time");
  private _pathsHeaderRenderer = this._filterHeaderRenderer("paths", "Paths");
  private _tagsHeaderRenderer = this._filterHeaderRenderer("tags", "Tags");
  private _hostnameHeaderRenderer = this._filterHeaderRenderer("hostname", "Hostname");

  private _actionDisposers: mobx.IReactionDisposer[] = [];

  constructor() {
    super();
    // bind this to renderers
    this._timeRenderer = this._timeRenderer.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    // request auto column width update on snapshot changes
    this._actionDisposers.push(
      mobx.reaction(
        () => appState.snapShots,
        () => {
          this._recalculateColumnWidths = true;
        },
        { fireImmediately: true },
      ),
    );
    // sync selection changes with appState
    const updateGridSelectionFromAppState = () => {
      const selectedSnapshot = appState.snapShots.find((v) => v.id === appState.selectedSnapshotID);
      this._selectedItems = selectedSnapshot ? [selectedSnapshot] : [];
    };
    this._actionDisposers.push(
      mobx.reaction(
        () => appState.selectedSnapshotID,
        () => {
          // when switching snapshot ids, update the selection in our grid
          updateGridSelectionFromAppState();
        },
        { fireImmediately: true },
      ),
    );
    this._actionDisposers.push(
      mobx.reaction(
        () => appState.isLoadingSnapshots > 0,
        (isLoading: boolean) => {
          // when loading finished, this is the first time the grid actually is shown
          if (!isLoading) {
            updateGridSelectionFromAppState();
          }
        },
        { fireImmediately: false },
      ),
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    for (const disposer of this._actionDisposers) {
      disposer();
    }
    this._actionDisposers = [];
  }

  private _activeItemChanged(e: GridActiveItemChangedEvent<restic.Snapshot>) {
    const item = e.detail.value;
    // don't deselect selected items and ensure it's a valid snapshot
    if (item && appState.snapShots.includes(item)) {
      this._selectedItems = [item];
      appState.setNewSnapshotId(item.id);
    }
  }

  private _cellFocusChanged(event: GridCellFocusEvent<restic.Snapshot>) {
    // auto-select rows on cell focus navigation
    const item = event.detail.context?.item;
    if (item && appState.snapShots.includes(item)) {
      this._selectedItems = [item];
      appState.setNewSnapshotId(item.id);
    }
  }

  private _timeRenderer(
    root: HTMLElement,
    _column: GridColumn<restic.Snapshot>,
    model: GridItemModel<restic.Snapshot>,
  ) {
    render(html`${formatDateTime(model.item.time)}`, root);
  }

  private _snapshotFilterValues(snapshot: restic.Snapshot, path: string): string[] {
    if (path === "time") {
      return [snapshotMonth(snapshot.time)];
    }
    const value = snapshot[path as keyof restic.Snapshot];
    return Array.isArray(value) ? value : [String(value ?? "")];
  }

  // must match how the grid's array data provider filters items
  private _matchesFilters(snapshot: restic.Snapshot, exceptPath?: string): boolean {
    return [...this._filterValues.entries()].every(
      ([path, value]) =>
        path === exceptPath ||
        value === "" ||
        String(snapshot[path as keyof restic.Snapshot] ?? "")
          .toLowerCase()
          .includes(value.toLowerCase()),
    );
  }

  // only snapshots which pass the *other* columns' filters contribute their values, so the
  // offered values narrow down as filters get applied
  private _filterOptions(path: string): { label: string; value: string }[] {
    const values = new Set<string>();
    for (const snapshot of appState.snapShots) {
      if (this._matchesFilters(snapshot, path)) {
        for (const value of this._snapshotFilterValues(snapshot, path)) {
          if (value !== "") {
            values.add(value);
          }
        }
      }
    }
    // always keep the selected value listed, else it could not be unselected again
    const selectedValue = this._filterValues.get(path) ?? "";
    if (selectedValue !== "") {
      values.add(selectedValue);
    }
    const sortedValues = [...values].sort();
    if (path === "time") {
      // show the most recent months first
      sortedValues.reverse();
    }
    return [
      { label: "Show all", value: NO_FILTER_VALUE },
      ...sortedValues.map((value) => ({ label: value, value })),
    ];
  }

  // the label must match the one the grid generates from the column's path
  private _plainHeaderRenderer(
    path: string,
    label: string,
  ): GridHeaderFooterRenderer<restic.Snapshot> {
    return (root: HTMLElement) => {
      this._headerUpdaters.set(path, () => this._renderPlainHeader(label, root));
      this._renderPlainHeader(label, root);
    };
  }

  private _renderPlainHeader(label: string, root: HTMLElement) {
    render(
      html`
        <div class="filter-header ${this._showFilters ? "" : "hidden-filters"}">
          <span class="header-label">${label}</span>
          <vaadin-select class="dummy-filter" theme="small"></vaadin-select>
        </div>
      `,
      root,
    );
  }

  // the grid picks up the rendered `vaadin-grid-filter` and filters its items on its own
  private _filterHeaderRenderer(
    path: string,
    label: string,
  ): GridHeaderFooterRenderer<restic.Snapshot> {
    return (root: HTMLElement) => {
      this._headerUpdaters.set(path, () => this._renderFilterHeader(path, label, root));
      this._renderFilterHeader(path, label, root);
      if (!this._renderedHeaderRoots.has(root)) {
        // the auto column widths may have been calculated before this header cell existed
        this._renderedHeaderRoots.add(root);
        this._recalculateColumnWidths = true;
        this.requestUpdate();
      }
    };
  }

  private _renderFilterHeader(path: string, label: string, root: HTMLElement) {
    const value = this._filterValues.get(path) ?? "";
    render(
      html`
        <div class="filter-header ${this._showFilters ? "" : "hidden-filters"}">
          <vaadin-grid-sorter path=${path} direction=${path === "time" ? "desc" : nothing}>
            ${label}
          </vaadin-grid-sorter>
          <vaadin-grid-filter path=${path} .value=${value}>
            <vaadin-select
              slot="filter"
              theme="small"
              .items=${this._filterOptions(path)}
              .value=${value === "" ? NO_FILTER_VALUE : value}
              @change=${(event: Event) => this._filterValueChanged(path, event)}
            >
            </vaadin-select>
          </vaadin-grid-filter>
        </div>
      `,
      root,
    );
  }

  private _updateHeaders() {
    for (const update of this._headerUpdaters.values()) {
      update();
    }
  }

  // hiding the filters also clears them, so the list never is filtered by an invisible filter
  private _toggleFilters() {
    this._showFilters = !this._showFilters;
    if (!this._showFilters) {
      this._clearFilters();
    }
    // the header cells changed their height
    this._recalculateColumnWidths = true;
  }

  private _clearFilters() {
    this._filterValues.clear();
    // the filter elements stay in the DOM when hidden, so the grid keeps track of them
    for (const filter of this.renderRoot.querySelectorAll("vaadin-grid-filter")) {
      filter.value = "";
    }
  }

  private _filterValueChanged(path: string, event: Event) {
    const target = event.target as HTMLElement & { value: string };
    const selectValue = target.value ?? "";
    const value = selectValue === NO_FILTER_VALUE ? "" : selectValue;
    if ((this._filterValues.get(path) ?? "") === value) {
      return;
    }
    this._filterValues.set(path, value);
    // `vaadin-grid-filter` only binds its *own* filter field's value: forward ours manually
    const filter = target.closest("vaadin-grid-filter");
    if (filter) {
      filter.value = value;
    }
    this._clearSelectionWhenFiltered();
    // deferred: the select which fired the change still is busy applying it
    queueMicrotask(() => this._updateHeaders());
  }

  private _clearSelectionWhenFiltered() {
    const selectedSnapshot = appState.snapShots.find((v) => v.id === appState.selectedSnapshotID);
    if (selectedSnapshot && !this._matchesFilters(selectedSnapshot)) {
      appState.clearSnapshotSelection();
    }
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
    }
    #header {
      align-items: center;
      background: var(--lumo-shade-10pct);
      padding: 4px;
    }
    #header #title {
      margin: 0px 10px;
      padding: 4px 0px;
    }
    #header #filterButton {
    }
    #loading {
      height: 100%;
      align-items: center;
      justify-content: center;
    }
    #grid {
      height: unset;
      flex: 1;
      margin: 0px 8px;
    }
    .filter-header {
      display: flex;
      flex-direction: column;
      align-items: stretch;
    }
    .filter-header vaadin-grid-filter {
      width: 100%;
    }
    .filter-header .header-label {
      display: inline-flex;
      align-items: center;
    }
    .filter-header vaadin-select {
      /* the "small" theme still is too tall for a grid header */
      --lumo-text-field-size: var(--lumo-size-xs);
      font-size: var(--lumo-font-size-xs);
      width: 100%;
      min-width: 7em;
      padding-top: 0px;
      padding-bottom: 0px;
    }
    .filter-header vaadin-select [slot="value"] {
      /* the selected item's height is what sets the select's height */
      --_lumo-selected-item-height: var(--lumo-size-xs);
      --_lumo-selected-item-padding: 0px;
    }
    .filter-header vaadin-select.dummy-filter {
      /* only present to align the label with the filterable columns' labels */
      visibility: hidden;
      width: 0px;
      min-width: 0px;
    }
    .filter-header.hidden-filters vaadin-grid-filter,
    .filter-header.hidden-filters vaadin-select {
      display: none;
    }
  `;

  updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    // the offered filter values may have changed
    this._updateHeaders();
    // apply auto column width updates after content got rendered
    if (this._recalculateColumnWidths) {
      this._recalculateColumnWidths = false;
      if (this._grid) {
        this._grid.recalculateColumnWidths();
      }
    }
  }

  render() {
    const header = html`
      <vaadin-horizontal-layout id="header" style="">
        <strong id="title">Snapshots</strong>
        <vaadin-button
          id="filterButton"
          theme=${this._showFilters ? "icon small secondary" : "icon small tertiary"}
          title=${this._showFilters ? "Hide Filters" : "Show Filters"}
          @click=${this._toggleFilters}
        >
          <vaadin-icon icon="vaadin:filter"></vaadin-icon>
        </vaadin-button>
      </vaadin-horizontal-layout>
    `;

    if (appState.isLoadingSnapshots > 0) {
      return html`
        ${header}
        <vaadin-horizontal-layout id="loading">
          <restic-browser-spinner size="24px"></restic-browser-spinner>
        </vaadin-horizontal-layout>
      `;
    }

    return html`
      ${header}
      <vaadin-grid
        id="grid"
        theme="compact no-border"
        .items=${appState.snapShots}
        .selectedItems=${this._selectedItems}
        @active-item-changed=${this._activeItemChanged}
        @cell-focus=${this._cellFocusChanged}
      >
        <vaadin-grid-column .flexGrow=${0} .autoWidth=${true} path="short_id"
           .headerRenderer=${this._shortIdHeaderRenderer}></vaadin-grid-column>
        <vaadin-grid-column .flexGrow=${0} .autoWidth=${true} path="time"
           .renderer=${this._timeRenderer}
           .headerRenderer=${this._timeHeaderRenderer}></vaadin-grid-column>
        <vaadin-grid-column .flexGrow=${1} path="paths"
           .headerRenderer=${this._pathsHeaderRenderer}></vaadin-grid-column>
        <vaadin-grid-column .flexGrow=${0} .autoWidth=${true} path="tags"
           .headerRenderer=${this._tagsHeaderRenderer}></vaadin-grid-column>
        <vaadin-grid-column .flexGrow=${0} .autoWidth=${true} path="hostname"
           .headerRenderer=${this._hostnameHeaderRenderer}></vaadin-grid-column>
        <!-- <vaadin-grid-sort-column path="username"></vaadin-grid-sort-column> -->
      </vaadin-grid>
    `;
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    "restic-browser-snapshot-list": ResticBrowserSnapshotList;
  }
}

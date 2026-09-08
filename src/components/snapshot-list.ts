import { MobxLitElement } from "@adobe/lit-mobx";
import type {
  Grid,
  GridActiveItemChangedEvent,
  GridCellFocusEvent,
  GridColumn,
  GridItemModel,
} from "@vaadin/grid";
import { css, html, type PropertyValues, render, nothing } from "lit";
import { dialogRenderer } from "@vaadin/dialog/lit";
import { customElement, query, state } from "lit/decorators.js";
import * as mobx from "mobx";

import type { restic } from "../backend/restic";
import { appState } from "../states/app-state";

import "./spinner";

import "@vaadin/button";
import "@vaadin/checkbox";
import "@vaadin/dialog";
import "@vaadin/icons";
import "@vaadin/horizontal-layout";
import "@vaadin/grid";
import "@vaadin/grid/vaadin-grid-sort-column.js";
import "@vaadin/vertical-layout";

// -------------------------------------------------------------------------------------------------

// Columns which can be filtered via the right-click context menu
const FILTERABLE_COLUMNS = ["paths", "tags", "hostname"] as const;

// Human readable display names for filter dialog titles
const FILTER_COLUMN_DISPLAY_NAMES: Record<string, string> = {
  paths: "Paths",
  tags: "Tags",
  hostname: "Hostname",
};

// raw filter value(s) of a snapshot for the given column
function snapshotFilterValues(snapshot: restic.Snapshot, column: string): string[] {
  switch (column) {
    case "paths":
      return [...snapshot.paths];
    case "tags":
      return [...snapshot.tags];
    case "hostname":
      return [snapshot.hostname];
    default:
      return [];
  }
}

// -------------------------------------------------------------------------------------------------

// Snapshot list / table.

@customElement("restic-browser-snapshot-list")
export class ResticBrowserSnapshotList extends MobxLitElement {
  @state()
  private _selectedItems: restic.Snapshot[] = [];

  @query("#grid")
  private _grid!: Grid<restic.Snapshot> | null;
  private _recalculateColumnWidths: boolean = false;
  // grid element the contextmenu listener is attached to
  private _contextMenuTarget: Element | null = null;
  private _contextMenuHandler = (event: Event) =>
    this._contextMenu(event as MouseEvent);

  // active filters, one entry per column: set of selected filter values
  @mobx.observable
  private _columnFilters: Map<string, Set<string>> = new Map();
  // column currently shown in the filter dialog
  @mobx.observable
  private _filterColumn: string | null = null;
  // filter dialog visibility
  @mobx.observable
  private _filterDialogOpen: boolean = false;

  private _actionDisposers: mobx.IReactionDisposer[] = [];

  constructor() {
    super();
    mobx.makeObservable(this);
    // bind this to renderers and handlers
    this._timeRenderer = this._timeRenderer.bind(this);
    this._contextMenu = this._contextMenu.bind(this);
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
    // clear selection when the selected snapshot was removed by a filter
    this._actionDisposers.push(
      mobx.reaction(
        () => this.filteredSnapshots,
        (filtered) => {
          const selectedID = appState.selectedSnapshotID;
          if (selectedID !== "" && !filtered.some((s) => s.id === selectedID)) {
            appState.clearSnapshotSelection();
          }
        },
      ),
    );
    // keep a "filtered" icon in the header of each column with an active
    // filter (deps: serialized filter state, since ObservableMap identity
    // never changes)
    this._actionDisposers.push(
      mobx.reaction(
        () =>
          [...this._columnFilters.entries()]
            .map(([c, v]) => c + ":" + Array.from(v).sort().join(","))
            .sort()
            .join(";"),
        () => this._syncFilterHeaderIcons(),
      ),
    );
    // auto-prune checked filter values that can no longer match any snapshot
    // (i.e. the checked values contradict the other active filters), so the
    // user rarely ends up in the "no snapshots match" failsafe state
    this._actionDisposers.push(
      mobx.reaction(
        () =>
          // serialize filter state (ObservableMap identity never changes)
          // and snapshot identity (fires when the loaded list changes)
          appState.snapShots.length +
            ";" +
            [...this._columnFilters.entries()]
              .map(([c, v]) => c + ":" + Array.from(v).sort().join(","))
              .sort()
              .join(";"),
        () => {
          if (!this.hasActiveFilters()) {
            return;
          }
          const pruned: Array<[string, string]> = [];
          for (const [column, values] of [...this._columnFilters.entries()]) {
            for (const value of [...values]) {
              // a checked value is stale if no snapshot has it AND passes
              // all the other columns' filters
              const matches = appState.snapShots.some((snapshot) =>
                snapshotFilterValues(snapshot, column).includes(value) &&
                [...this._columnFilters.entries()].every(([c, vs]) =>
                  c === column
                    ? true
                    : vs.size === 0
                      ? true
                      : snapshotFilterValues(snapshot, c).some((x) => vs.has(x)),
                ),
              );
              if (!matches) {
                pruned.push([column, value]);
              }
            }
          }
          for (const [column, value] of pruned) {
            mobx.runInAction(() => {
              const set = this._columnFilters.get(column);
              if (set) {
                set.delete(value);
                if (set.size === 0) {
                  this._columnFilters.delete(column);
                }
              }
            });
          }
        },
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

  // Keep a small "filtered" icon in the header cell of every filterable
  // column that currently has an active filter, so the user can see at a
  // glance which columns are filtered.
  //
  // The grid's header cell DOM is: th > slot > vaadin-grid-cell-content >
  // vaadin-grid-sorter (the column name). The icon is inserted as the first
  // child of the cell-content element, i.e. prefixed to the column name.
  //
  // This is imperative (not a template) because the header cell content is
  // owned by Vaadin and re-created on grid refresh; a MobX reaction plus a
  // re-sync in `updated()` keeps the icons in sync with both filter state
  // and grid element recreation. Idempotent: safe to run any number of times.
  private _syncFilterHeaderIcons(): void {
    const grid = this._grid;
    if (!grid || !grid.shadowRoot) {
      return;
    }
    const columns = Array.from(grid.children).filter((el: Element) =>
      el.localName === "vaadin-grid-column" || el.localName === "vaadin-grid-sort-column",
    );
    const headerCells = Array.from(
      grid.shadowRoot.querySelectorAll("th[role='columnheader']"),
    );
    columns.forEach((column, index) => {
      const path = column.getAttribute("path") ?? "";
      if (!(FILTERABLE_COLUMNS as readonly string[]).includes(path)) {
        return;
      }
      const cell = headerCells[index];
      const slot = cell?.querySelector("slot");
      const content = slot?.assignedElements()?.[0];
      if (!content) {
        return;
      }
      const active = (this._columnFilters.get(path)?.size ?? 0) > 0;
      let icon = content.querySelector("vaadin-icon.filter-header-icon") as HTMLElement | null;
      if (active) {
        if (!icon) {
          const el = document.createElement("vaadin-icon");
          el.setAttribute("icon", "vaadin:filter");
          el.classList.add("filter-header-icon");
          el.setAttribute("title", "Filtered");
          content.insertBefore(el, content.firstChild);
          icon = el;
        }
        icon.hidden = false;
      } else if (icon) {
        icon.remove();
      }
    });
  }

  // snapshots after all active column filters have been applied
  @mobx.computed
  private get filteredSnapshots(): restic.Snapshot[] {
    return appState.snapShots.filter((snapshot) =>
      [...this._columnFilters.entries()].every(([column, values]) =>
        values.size === 0
          ? true
          : snapshotFilterValues(snapshot, column).some((value) => values.has(value)),
      ),
    );
  }

  // distinct filter values for the given column, faceted: only snapshots
  // that pass all the *other* columns' filters contribute their values,
  // so the dialog options narrow as other filters get applied
  private distinctFilterValues(column: string): string[] {
    const otherFilters = [...this._columnFilters.entries()].filter(
      ([c]) => c !== column,
    );
    const candidates = appState.snapShots.filter((snapshot) =>
      otherFilters.every(([c, values]) =>
        values.size === 0
          ? true
          : snapshotFilterValues(snapshot, c).some((v) => values.has(v)),
      ),
    );
    const values = new Set<string>();
    for (const snapshot of candidates) {
      for (const value of snapshotFilterValues(snapshot, column)) {
        values.add(value);
      }
    }
    return [...values].sort();
  }

  private hasActiveFilters(): boolean {
    return [...this._columnFilters.values()].some((values) => values.size > 0);
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
    render(html`${new Date(model.item.time).toLocaleString()}`, root);
  }

  // resolve the column header under the given viewport coordinates.
  // NB: Vaadin Grid renders its header cells as <td role="columnheader"> in its
  // shadow root (no <th>, no `field` attribute), so we match by position and
  // map the hit back to the light-DOM column elements by index.
  private _columnAt(x: number, y: number): string | null {
    const grid = this._grid;
    if (!grid) {
      return null;
    }
    const headerCells = Array.from(
      grid.shadowRoot?.querySelectorAll("th[role='columnheader']") ?? [],
    );
    const hit = headerCells.find((cell) => {
      const rect = cell.getBoundingClientRect();
      return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom;
    });
    if (!hit) {
      return null;
    }
    const index = headerCells.indexOf(hit);
    const columns = Array.from(grid.children).filter((el: Element) =>
      el.localName === "vaadin-grid-column" || el.localName === "vaadin-grid-sort-column",
    );
    return columns[index]?.getAttribute("path") ?? null;
  }

  // right-click on a column header opens the filter dialog for that column.
  // NB: must be attached inside the grid's shadow root, because `contextmenu`
  // does not cross the shadow boundary to the light-DOM grid element.
  private _contextMenu(event: MouseEvent) {
    // ignore right-clicks while snapshots are loading: in the loading branch
    // there is no <vaadin-dialog> element in the DOM, so arming the dialog
    // state here would silently stick until the next refresh
    if (appState.isLoadingSnapshots > 0) {
      return;
    }
    event.preventDefault();
    const column = this._columnAt(event.clientX, event.clientY);
    if (!column || !(FILTERABLE_COLUMNS as readonly string[]).includes(column)) {
      return;
    }
    mobx.runInAction(() => {
      this._filterColumn = column;
      this._filterDialogOpen = true;
    });
  }

  private _clearColumnFilters(column: string) {
    mobx.runInAction(() => {
      this._columnFilters.delete(column);
    });
  }

  private _clearAllFilters() {
    mobx.runInAction(() => {
      this._columnFilters.clear();
      this._filterDialogOpen = false;
    });
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
    #header #filter-indicator {
      margin-left: auto;
      align-items: center;
    }
    #header #filter-indicator span {
      margin-right: 8px;
      font-size: 0.8em;
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
    #empty {
      height: 100%; 
      align-items: center;
      justify-content: center;
    }
    #empty p {
      margin: 0px;
    }
    vaadin-icon.filter-header-icon {
      width: 12px;
      height: 12px;
      margin-right: 4px;
      color: var(--lumo-contrast-70pct);
    }
    #filter-layout {
      width: 360px;
      max-width: 90vw;
    }
    #filter-options {
      max-height: 240px;
      overflow-y: auto;
      padding: 8px 16px;
    }
  `;

  updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    // apply auto column width updates after content got rendered
    if (this._recalculateColumnWidths) {
      this._recalculateColumnWidths = false;
      if (this._grid) {
        this._grid.recalculateColumnWidths();
      }
    }
    // attach the contextmenu listener to the grid's shadow root (see above)
    if (this._grid && this._contextMenuTarget !== this._grid) {
      if (this._contextMenuTarget) {
        this._contextMenuTarget.shadowRoot?.removeEventListener(
          "contextmenu",
          this._contextMenuHandler,
        );
      }
      this._grid.shadowRoot?.addEventListener("contextmenu", (event: Event) =>
        this._contextMenu(event as MouseEvent),
      );
      this._contextMenuTarget = this._grid;
    }
    // re-sync the header filter icons: the grid (and its header cells) is
    // destroyed and recreated on refresh, so icons must be re-applied here
    this._syncFilterHeaderIcons();
    // Self-heal the dialog state: Lit property bindings are only (re)applied
    // on render commits. If a render-commit micro-race left the dialog
    // element's `opened` diverged from `_filterDialogOpen` (e.g. the element
    // was recreated mid-commit and the pending `.opened=true` binding was
    // dropped or reverted by a stray `@closed`), snap it back into sync here.
    // This runs after every commit, so the "armed but invisible" dialog
    // state can never survive a render cycle.
    const dialog = this.renderRoot.querySelector("vaadin-dialog");
    if (dialog && dialog.opened !== this._filterDialogOpen) {
      dialog.opened = this._filterDialogOpen;
    }
  }

  render() {
    const filterIndicator = this.hasActiveFilters()
      ? html`
        <vaadin-horizontal-layout id="filter-indicator">
          <span>Filtered</span>
          <vaadin-button theme="tertiary" @click=${this._clearAllFilters}>
            Clear filters
          </vaadin-button>
        </vaadin-horizontal-layout>
      `
      : nothing;

    const header = html`
      <vaadin-horizontal-layout id="header" style="">
        <strong id="title">Snapshots</strong>
        ${filterIndicator}
      </vaadin-horizontal-layout>
    `;

    // NB: the dialog element is present in ALL branches and only toggled via
    // `opened`. When `opened=false` it is inert, so a pending
    // `_filterDialogOpen=true` always has a live element to apply to, even if
    // set while the component was in the loading or empty branch.
    // Its content is provided through `dialogRenderer` — this version of
    // Vaadin only populates dialog content via a renderer, NOT via light-DOM
    // children of <vaadin-dialog>.
    //
    // `dialogRenderer` only re-runs its renderer when a dependency changes
    // (strict equality), so the dependencies must fully capture the filter
    // state: the active column plus a serialization of the checked values.
    const filterStateKey = Array.from(this._columnFilters.entries())
      .map(([column, values]) => column + ":" + Array.from(values).sort().join(","))
      .sort()
      .join(";");

    const filterDialog = html`
      <vaadin-dialog
        .opened=${this._filterDialogOpen}
        @closed=${() => mobx.runInAction(() => { this._filterDialogOpen = false; })}
        ${dialogRenderer(() => this._renderFilterDialogContent(), [
          this._filterColumn,
          filterStateKey,
        ])}
      >
      </vaadin-dialog>
    `;

    if (appState.isLoadingSnapshots > 0) {
      return html`
        ${header}
        <vaadin-horizontal-layout id="loading">
          <restic-browser-spinner size="24px"></restic-browser-spinner>
        </vaadin-horizontal-layout>
        ${filterDialog}
      `;
    }

    if (this.filteredSnapshots.length === 0 && appState.snapShots.length > 0) {
      return html`
        ${header}
        <vaadin-horizontal-layout id="empty">
          <p>No snapshots match the active filters. </p>
          <vaadin-button theme="primary" @click=${this._clearAllFilters}>
            Clear filters
          </vaadin-button>
        </vaadin-horizontal-layout>
        ${filterDialog}
      `;
    }

    return html`
      ${header}
      <vaadin-grid
        id="grid"
        theme="compact no-border" 
        .items=${this.filteredSnapshots}
        .selectedItems=${this._selectedItems}
        @active-item-changed=${this._activeItemChanged}
        @cell-focus=${this._cellFocusChanged}
      >
        <vaadin-grid-column .flexGrow=${0} .autoWidth=${true} path="short_id"></vaadin-grid-column>
        <vaadin-grid-sort-column .flexGrow=${0} .autoWidth=${true} path="time" 
           .renderer=${this._timeRenderer} direction="desc"></vaadin-grid-sort-column>
        <vaadin-grid-sort-column .flexGrow=${1} path="paths"></vaadin-grid-sort-column>
        <vaadin-grid-sort-column .flexGrow=${0} .autoWidth=${true} path="tags"></vaadin-grid-sort-column>
        <!-- Fixed width (not autoWidth): always leaves room for the "filtered"
             header icon + the "Hostname" label, so the label never truncates. -->
        <vaadin-grid-sort-column .flexGrow=${0} width="110px" path="hostname"></vaadin-grid-sort-column>
        <!-- <vaadin-grid-sort-column path="username"></vaadin-grid-sort-column> -->
      </vaadin-grid>
      ${filterDialog}
    `;
  }

  private _renderFilterDialogContent() {
    const column = this._filterColumn;
    if (!column) {
      return html``;
    }
    const values = this.distinctFilterValues(column);
    const activeValues = this._columnFilters.get(column) ?? new Set<string>();

    const options = values.length > 0
      ? values.map((value) =>
          html`
            <vaadin-checkbox 
              .checked=${activeValues.has(value)}
              @change=${(event: Event) =>
                mobx.runInAction(() => {
                  const checked = (event.target as HTMLInputElement).checked;
                  let set = this._columnFilters.get(column);
                  if (!set) {
                    // NOTE: the ObservableMap deep-converts plain Sets stored
                    // into it, so the local variable would end up pointing at a
                    // detached copy. Store the observable itself instead.
                    set = mobx.observable(new Set<string>());
                    this._columnFilters.set(column, set);
                  }
                  if (checked) {
                    set.add(value);
                  } else {
                    set.delete(value);
                  }
                  if (set.size === 0) {
                    this._columnFilters.delete(column);
                  }
                })
              }
              .label=${value}
            ></vaadin-checkbox>
          `
        )
      : html`<p>No filter values available for this column.</p>`;

    return html`
      <vaadin-vertical-layout id="filter-layout">
        <vaadin-horizontal-layout>
          <strong>Filter by ${FILTER_COLUMN_DISPLAY_NAMES[column] ?? column}</strong>
        </vaadin-horizontal-layout>
        <vaadin-vertical-layout id="filter-options">
          ${options}
        </vaadin-vertical-layout>
        <vaadin-horizontal-layout justify-content="end">
          <vaadin-button @click=${() => this._clearColumnFilters(column)}>
            Clear filters
          </vaadin-button>
          <vaadin-button theme="primary" @click=${() => mobx.runInAction(() => {
            this._filterDialogOpen = false;
          })}>
            Done
          </vaadin-button>
        </vaadin-horizontal-layout>
      </vaadin-vertical-layout>
    `;
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    "restic-browser-snapshot-list": ResticBrowserSnapshotList;
  }
}

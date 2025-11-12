import { MobxLitElement } from "@adobe/lit-mobx";
import { dialogFooterRenderer } from "@vaadin/dialog/lit";
import { Notification } from "@vaadin/notification";
import { type CSSResultGroup, css, html, render, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import * as mobx from "mobx";

import { appState } from "../states/app-state";
import { Location } from "../states/location";
import type { LocationPreset } from "../states/location-preset";
import type { ResticBrowserLocationProperties } from "./location-properties";

import "./location-properties";
import "./location-presets";
import "./location-save-preset-dialog";
import "./location-password-dialog";

import "@vaadin/dialog";
import "@vaadin/horizontal-layout";
import "@vaadin/button";
import "@vaadin/notification";

// -------------------------------------------------------------------------------------------------

/**
 * Modal dialog to manage location presets and to set appState.repoLocation.
 */

@customElement("restic-browser-location-dialog")
export class ResticBrowserLocationDialog extends MobxLitElement {
  // called when the dialog's 'Okay' button was invoked.
  @property()
  onClose!: () => void;

  // called when the dialog's 'Cancel' button was invoked or the dialog got cancelled.
  @property()
  onCancel!: () => void;

  // when true, show save preset dialog instead of main dialog
  @state()
  private _showSavePresetDialog: boolean = false;
  // when true, show get password dialog instead of main dialog
  @state()
  private _showPasswordDialog: boolean = false;

  // when true, enter preset editing mode
  @state()
  private _editingPreset: boolean = false;

  // location state before opening Save Preset dialog
  private _newPresetLocation: Location = new Location();
  // location state when we got opened
  private _initialLocation: Location = new Location();

  // when true, cancel or okay hooks have been called, else dialog shut down otherwise
  private _handledClose: boolean = false;

  // render root of the dialog content, used to resolve it's components
  private _dialogContentRoot: HTMLElement | undefined = undefined;

  constructor() {
    super();

    // memorize actual location to restore it on cancel
    this._initialLocation.setFromOtherLocation(appState.repoLocation);

    // bind this to all callbacks
    this._handleMainDialogCancel = this._handleMainDialogCancel.bind(this);
    this._handleMainDialogClose = this._handleMainDialogClose.bind(this);

    this._handlePresetDoubleClick = this._handlePresetDoubleClick.bind(this);

    this._handleShowSavePresetDialog = this._handleShowSavePresetDialog.bind(this);
    this._handleSavePresetDialogClose = this._handleSavePresetDialogClose.bind(this);
    this._handleSavePresetDialogCancel = this._handleSavePresetDialogCancel.bind(this);

    this._handleShowPasswordDialog = this._handleShowPasswordDialog.bind(this);
    this._handlePasswordDialogClose = this._handlePasswordDialogClose.bind(this);
    this._handlePasswordDialogCancel = this._handlePasswordDialogCancel.bind(this);

    this._handleStartEditingPreset = this._handleStartEditingPreset.bind(this);
    this._handleFinishEditingPreset = this._handleFinishEditingPreset.bind(this);
    this._handleCancelEditingPreset = this._handleCancelEditingPreset.bind(this);
  }

  static dialogStyles: CSSResultGroup = css`
    // #dialogContent { }
    #locationPresets {
      margin-right: 1rem; 
    }
    // #locationProperties { }
    #locationPropertyButtons {
      margin-top: 1rem
    }
  `;

  static footerStyles: CSSResultGroup = css`
    // #footerContent { }
  `;

  render() {
    // save preset dialog
    if (this._showSavePresetDialog) {
      return html`
        <restic-browser-location-save-preset-dialog 
          .onClose=${this._handleSavePresetDialogClose} 
          .onCancel=${this._handleSavePresetDialogCancel}
        >
        </restic-browser-location-save-preset-dialog>
      `;
    }

    // get repository password dialog
    if (this._showPasswordDialog) {
      return html`
        <restic-browser-location-password-dialog 
          .onClose=${this._handlePasswordDialogClose} 
          .onCancel=${this._handlePasswordDialogCancel}
        >
        </restic-browser-location-password-dialog>
      `;
    }

    // main dialog
    const newLocationPresetSelected =
      appState.selectedLocationPreset === appState.locationPresets[0];

    let propertyButtons: TemplateResult;
    if (newLocationPresetSelected) {
      propertyButtons = html`
        <vaadin-horizontal-layout id="locationPropertyButtons">
          <vaadin-button 
            theme="primary"
            @click=${this._handleShowSavePresetDialog}
          > Save as new Preset
          </vaadin-button>
        </vaadin-horizontal-layout>
      `;
    } else if (!this._editingPreset) {
      propertyButtons = html`
        <vaadin-horizontal-layout id="locationPropertyButtons">
          <vaadin-button theme="primary" 
            @click=${this._handleStartEditingPreset}
          > Edit
          </vaadin-button>
        </vaadin-horizontal-layout>
      `;
    } else {
      propertyButtons = html`
          <vaadin-horizontal-layout id="locationPropertyButtons">
            <vaadin-button 
              theme="primary" 
              @click=${this._handleFinishEditingPreset}
            > Save
            </vaadin-button>
            <div style="width: 4px"></div>
            <vaadin-button 
              @click=${this._handleCancelEditingPreset}
            > Cancel
            </vaadin-button>
          </vaadin-horizontal-layout>
        `;
    }

    const dialogLayout = html`
      <style>${ResticBrowserLocationDialog.dialogStyles}</style>
      <vaadin-horizontal-layout id="dialogContent">
        <restic-browser-location-presets 
          id="locationPresets"
          .onDoubleClick=${this._handlePresetDoubleClick}
        ></restic-browser-location-presets>
        <vaadin-vertical-layout>
          <restic-browser-location-properties 
            id="locationProperties"
            .allowEditing=${newLocationPresetSelected || this._editingPreset}
          >
          </restic-browser-location-properties> 
          ${propertyButtons}
        </vaadin-vertical-layout>
      </vaadin-horizontal-layout>
    `;

    const footerLayout = html`
      <style>${ResticBrowserLocationDialog.footerStyles}</style>
      <vaadin-horizontal-layout id="footerContent">
        <div style="flex-grow: 1"></div>
        <vaadin-button 
          @click=${this._handleMainDialogCancel}
        > Cancel 
        </vaadin-button>
        <div style="width: 4px"></div>
        <vaadin-button 
          theme="primary" 
          .disabled=${this._editingPreset && !newLocationPresetSelected} 
          @click=${this._handleMainDialogClose}
        > Okay
        </vaadin-button>
      </vaadin-horizontal-layout>
    `;

    return html`
      <vaadin-dialog
        header-title="Open Repository"
        .opened=${true}
        .noCloseOnOutsideClick=${true}
        @opened-changed=${(event: CustomEvent) => {
          if (
            !event.detail.value &&
            !this._handledClose &&
            !this._showSavePresetDialog &&
            !this._showPasswordDialog
          ) {
            this._handleMainDialogCancel();
          }
        }}
        ${dialogFooterRenderer(() => footerLayout, [])}
        .renderer=${(root: HTMLElement) => {
          this._dialogContentRoot = root;
          render(dialogLayout, root);
        }}
      ></vaadin-dialog>
    `;
  }

  private get _locationProperties(): ResticBrowserLocationProperties | undefined {
    if (this._dialogContentRoot) {
      return this._dialogContentRoot.querySelector(
        "#locationProperties",
      ) as ResticBrowserLocationProperties;
    } else {
      return undefined;
    }
  }

  private _handleMainDialogClose() {
    // set appState's location from properties component
    const locationProperties = this._locationProperties;
    if (locationProperties) {
      appState.repoLocation.setFromOtherLocation(locationProperties.location);
    } else {
      console.error("Failed to fetch location properties component");
    }
    // ask for repo password?
    appState.setRepositoryPassword("");
    if (
      appState.repoLocation.path &&
      !appState.repoLocation.allowEmptyPassword &&
      !appState.repoLocation.password
    ) {
      this._handleShowPasswordDialog();
      return;
    }
    // reset state and clone
    this._handledClose = true;
    this._editingPreset = false;
    this.onClose();
  }

  private _handleMainDialogCancel() {
    // restore location to initial state
    mobx.runInAction(() => {
      appState.setRepositoryPassword("");
      appState.setSelectedLocationPreset(appState.locationPresets[0]);
      appState.setRepositoryLocation(this._initialLocation);
    });
    // reset state and clone
    this._handledClose = true;
    this._editingPreset = false;
    this.onCancel();
  }

  private _handlePresetDoubleClick(preset: LocationPreset) {
    // set appState's location from properties component
    appState.setRepositoryLocation(preset.location);
    // ask for repo password?
    appState.setRepositoryPassword("");
    if (appState.repoLocation.path && !appState.repoLocation.password) {
      this._handleShowPasswordDialog();
      return;
    }
    // reset state and clone
    this._handledClose = true;
    this._editingPreset = false;
    this.onClose();
  }

  private _handleShowSavePresetDialog() {
    // memorize location state from the properties before closing the main dialog
    const locationProperties = this._locationProperties;
    if (locationProperties) {
      this._newPresetLocation.setFromOtherLocation(locationProperties.location);
    } else {
      console.error("Failed to fetch location properties component");
    }
    // open preset save dialog
    this._showSavePresetDialog = true;
  }

  private _handleSavePresetDialogClose(presetName: string, savePasswords: boolean): boolean {
    if (presetName) {
      // create new location preset from the properties
      appState.addLocationPreset(this._newPresetLocation, presetName, savePasswords);
      // close save preset dialog
      this._showSavePresetDialog = false;
      this._editingPreset = false;
      return true;
    } else {
      Notification.show("No preset name set", {
        position: "middle",
        theme: "info",
        duration: 2000,
      });
      return false;
    }
  }

  private _handleSavePresetDialogCancel() {
    // close save preset dialog
    this._showSavePresetDialog = false;
    this._editingPreset = false;
  }

  private _handleShowPasswordDialog() {
    this._showPasswordDialog = true;
  }

  private _handlePasswordDialogClose(password: string) {
    // set repo password
    appState.setRepositoryPassword(password);
    // reset state and clone
    this._showPasswordDialog = false;
    this._handledClose = true;
    this._editingPreset = false;
    this.onClose();
  }

  private _handlePasswordDialogCancel() {
    // reset repo password
    appState.setRepositoryPassword("");
    this._showPasswordDialog = false;
  }

  private _handleStartEditingPreset() {
    // start editing
    this._editingPreset = true;
  }

  private _handleFinishEditingPreset() {
    // set appState's location from properties
    const locationProperties = this._locationProperties;
    if (locationProperties) {
      appState.repoLocation.setFromOtherLocation(locationProperties.location);
    } else {
      console.error("Failed to fetch location properties component");
    }
    // stop editing
    this._editingPreset = false;
  }

  private _handleCancelEditingPreset() {
    // stop editing
    this._editingPreset = false;
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    "restic-browser-location-dialog": ResticBrowserLocationDialog;
  }
}

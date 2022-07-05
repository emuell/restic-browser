import { css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';

import './components/file-list';
import './components/snapshot-list';
import './components/location-dialog';
import './components/error-message';

import { OpenRepo } from '../wailsjs/go/lib/ResticBrowserApp';
import { lib } from '../wailsjs/go/models';

import { appState } from './states/app-state';

import '@vaadin/button';
import '@vaadin/vertical-layout';
import '@vaadin/horizontal-layout';

// -------------------------------------------------------------------------------------------------
 
// Main app layout.

@customElement('restic-browser-app')
export class ResticBrowserApp extends MobxLitElement {
  
  @state()
  private _showLocationDialog: boolean = false;

  private _openRepository() {
    OpenRepo(lib.Location.createFrom(appState.repoLocation), appState.repoPass)
      .then((result) => {
        if (result instanceof Error) {
          throw result;
        } 
        appState.setNewSnapshots(result);
      })
      .catch((err) => {
        appState.setNewSnapshots([], err.message || String(err));
      });
  }
  
  static styles = css`
    #layout {
       align-items: stretch; 
       width: 100vw; 
       height: 100%;
    }
    #header {
      align-items: center;
    }
    #header h3 {
      font-size: var(--lumo-font-size-l);
      margin-left: 20px;
      margin-right: 20px;
    }
    #header #repoPath {
      margin-left: 10px;
      color: var(--lumo-tint-50pct);
      margin-top: 4px;
      margin-right: 20px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #header #repoPath.disabled {
      color: var(--lumo-tint-10pct);
    }
    #snapshots {
      height: 35vh;
    }
    #filelist {
      height: 100%;
    }
  `;

  render() {
    // repository location
    if (this._showLocationDialog) {
      return html`
        <restic-browser-location-dialog 
          .onClose=${() => {
            this._showLocationDialog = false;
            this._openRepository();
          }}
          .onCancel=${() => {
            this._showLocationDialog = false; 
            appState.resetLocation(); 
          }}></restic-browser-location-dialog>
      `;
    }
    // repository content
    else {
      const location = appState.repoLocation;
      const selectedRepositoryText = location.path ? 
        html`<div id="repoPath">
          ${(location.prefix ? `${location.prefix}: ` : "") + location.path}</div>` : 
        html`<div id="repoPath" class="disabled">
          no repository selected</div>`;
      const header = html`
        <vaadin-horizontal-layout id="header">
          <h3>Restic-Browser</h3>
          <vaadin-button theme="primary" @click=${() => this._showLocationDialog = true}>
            Open Repository
          </vaadin-button>
          ${selectedRepositoryText}
        </vaadin-horizontal-layout>
      `;
      
      if (appState.repoError || ! location.path) {
        const errorMessage = appState.repoError ? 
          `Failed to open repository: ${appState.repoError}` : 
          "No repository selected";
        return html`
          <vaadin-vertical-layout id="layout">
            ${header}
            <restic-browser-error-message type=${appState.repoError ? "error" : "info"} 
               message=${errorMessage}></restic-browser-error-message>
          </vaadin-vertical-layout>
        `;
      }
      else {
        return html`
          <vaadin-vertical-layout id="layout">
            ${header}
            <restic-browser-snapshot-list id="snapshots"></restic-browser-snapshot-list>
            <restic-browser-file-list id="filelist"></restic-browser-file-list>
          </vaadin-vertical-layout>
        `;
      }
    }
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'restic-browser-app': ResticBrowserApp
  }
}

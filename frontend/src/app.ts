import { css, html } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';

import { appState } from './states/app-state';

import './components/app-footer';
import './components/app-header';
import './components/file-list';
import './components/snapshot-list';
import './components/location-dialog';
import './components/error-message';

import '@vaadin/vertical-layout';
import '@vaadin/split-layout';

// -------------------------------------------------------------------------------------------------
 
// Main app layout.

@customElement('restic-browser-app')
export class ResticBrowserApp extends MobxLitElement {
  
  @state()
  private _showLocationDialog: boolean = false;

  static styles = css`
    #layout {
       align-items: stretch; 
       width: 100vw; 
       height: 100%;
    }
    #footer {
      height: auto;
    }
    #split {
      height: 100%;
      width: 100vw;
    }
    #snapshots {
      height: 30%;
      min-height: 25%;
    }
    #filelist {
      height: 70%;
      min-height: 25%;
    }
    #footer {
      height: 44px;
    }
  `;

  render() {
    // repository location dialog
    if (this._showLocationDialog) {
      return html`
        <restic-browser-location-dialog 
          .onClose=${() => {
            this._showLocationDialog = false;
            appState.openRepository();
          }}
          .onCancel=${() => {
            this._showLocationDialog = false; 
            appState.resetLocation(); 
          }}>
        </restic-browser-location-dialog>
      `;
    }
    // repository error
    if (appState.repoError || ! appState.repoLocation.path) {
      const errorMessage = appState.repoError ? 
        `Failed to open repository: ${appState.repoError}` : 
        "No repository selected";
      return html`
        <vaadin-vertical-layout id="layout">
          <restic-browser-app-header id="header" 
            .openRepositoryClick=${() => this._showLocationDialog = true }>
          </restic-browser-app-header>
          <restic-browser-error-message 
              type=${appState.repoError ? "error" : "info"} 
              message=${errorMessage}>
          </restic-browser-error-message>
        </vaadin-vertical-layout>
      `;
    }
    // repsitory browser layout
    return html`
      <vaadin-vertical-layout id="layout">
        <restic-browser-app-header id="header" 
          .openRepositoryClick=${() => this._showLocationDialog = true }>
        </restic-browser-app-header>
        <vaadin-split-layout id="split" orientation="vertical" theme="small">
        <restic-browser-snapshot-list id="snapshots"></restic-browser-snapshot-list>
          <restic-browser-file-list id="filelist"></restic-browser-file-list>
        </vaadin-split-layout> 
        <restic-browser-app-footer id="footer"></restic-browser-app-footer>
      </vaadin-vertical-layout>
    `;
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'restic-browser-app': ResticBrowserApp
  }
}

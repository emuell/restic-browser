import { css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { MobxLitElement } from '@adobe/lit-mobx';

import { appState } from '../states/app-state';

import eye from '../assets/images/eye.png'
import logo from '../assets/images/logo.png'

import '@vaadin/horizontal-layout';
import '@vaadin/button';

// -------------------------------------------------------------------------------------------------
 
// Allow opening new repositories and shows active repository in a header alike view

@customElement('restic-browser-app-header')
export class ResticBrowserAppHeader extends MobxLitElement {

  @property()
  openRepositoryClick?: () => void = undefined;
  @property()
  refreshRepositoryClick?: () => void = undefined;

  static styles = css`
    #header {
      align-items: center;
    }
    #header #eye {
      margin-left: 12px;
      width: auto; 
      height: var(--lumo-font-size-xxl);
    }
    #header #logo {
      margin-left: 8px;
      margin-right: 12px;
      width: auto; 
      height: var(--lumo-font-size-xl);
    }
    #header #repoPath {
      margin-left: 12px;
      color: var(--lumo-tint-50pct);
      margin-top: 4px;
      margin-right: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #header #repoPath.disabled {
      color: var(--lumo-tint-10pct);
    } 
  `;

  render() {
    let repositoryName = appState.repoLocation.clokedPath;
    if (repositoryName && appState.repoLocation.prefix) {
      repositoryName = appState.repoLocation.prefix + ": " + repositoryName;
    }
    if (! repositoryName) {
      repositoryName = "No repository selected";
    }
    return html`
      <vaadin-horizontal-layout id="header">
        <img src=${eye} id="eye" />
        <img src=${logo} id="logo" alt="Restic-Browser" />
        <vaadin-button theme="primary" 
          @click=${() => {
            if (this.openRepositoryClick) { 
              this.openRepositoryClick(); 
             } 
            } 
          }>
          Open Repository
        </vaadin-button>
        <div id="repoPath" class="${!appState.repoLocation.path ? "disabled" : ""}">
          ${repositoryName}
        </div>
          <vaadin-button theme="primary icon"
            .hidden=${appState.repoLocation.path == ''}
            @click=${() => {
              if (this.refreshRepositoryClick) {
                this.refreshRepositoryClick();
              }
            }}
            style="margin-left: auto; margin-right: 10px;"
          >
          <vaadin-icon icon="lumo:reload"></vaadin-icon>
        </vaadin-button>
      </vaadin-horizontal-layout>
    `;
  }
}

// -------------------------------------------------------------------------------------------------

declare global {
  interface HTMLElementTagNameMap {
    'restic-browser-app-header': ResticBrowserAppHeader
  }
}



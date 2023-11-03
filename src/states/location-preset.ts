import * as mobx from 'mobx';

import { Location } from './location';

// -------------------------------------------------------------------------------------------------

/*!
 * Represents an observable repository location preset item,
 * which basically is just a location with a display name.
 */

export class LocationPreset {

  @mobx.observable
  name: string = "New Location";

  @mobx.observable
  location: Location = new Location();

  constructor() {
    mobx.makeObservable(this);
  }

  // reset all location properties 
  @mobx.action
  reset(): void {
    this.name = "Untitled";
    this.location.reset();
  }
};

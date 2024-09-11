// This is a singleton that stores all data that needs to be stored before the Game starts any scenes
// For example, weapon choices from the React dropdowns at the start of the combat demo

class DataStore {
  instance: DataStore | null = null
  data: { [key: string]: any }

  getInstance() {
    if (!this.instance) {
      this.instance = new DataStore()
    }
    return this.instance
  }

  constructor() {
    if (this.instance) {
      throw new Error(
        'Instance already exists; this class is a singleton and can only be created once globally.',
      )
    }

    this.data = {
      weapons:{},
      inputToWeaponMaps: {},
    }
  }
}

export const dataStore = new DataStore()

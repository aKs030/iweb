export class MenuSearchKeyboardController {
  constructor() {
    this.items = [];
    this.selectedIndex = -1;
  }

  setItems(items) {
    this.items = Array.isArray(items) ? [...items] : [];
    this.selectedIndex = this.items.length > 0 ? 0 : -1;
    return this.selectedIndex;
  }

  clear() {
    this.items = [];
    this.selectedIndex = -1;
    return this.selectedIndex;
  }

  getSelectedIndex() {
    return this.selectedIndex;
  }

  setSelectedIndex(index) {
    const nextIndex = Number(index);
    if (!Number.isInteger(nextIndex)) return false;
    if (nextIndex < 0 || nextIndex >= this.items.length) return false;
    if (this.selectedIndex === nextIndex) return false;
    this.selectedIndex = nextIndex;
    return true;
  }

  moveSelection(direction) {
    const max = this.items.length;
    if (max === 0) return false;

    if (this.selectedIndex < 0) {
      this.selectedIndex = 0;
      return true;
    }

    this.selectedIndex = (this.selectedIndex + direction + max) % max;
    return true;
  }

  getActivationIndex() {
    if (this.items.length === 0) return -1;
    return this.selectedIndex >= 0 ? this.selectedIndex : 0;
  }
}

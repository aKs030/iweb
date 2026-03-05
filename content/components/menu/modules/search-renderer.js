export class MenuSearchRenderer {
  constructor(options = {}) {
    this.translate = options.translate;
    this.getCategoryLabel = options.getCategoryLabel;
    this.formatSearchResultUrl = options.formatSearchResultUrl;
    this.getFallbackSuggestions = options.getFallbackSuggestions;
    this.hasMarkedHighlight = options.hasMarkedHighlight;
    this.setPopupExpanded = options.setPopupExpanded;
  }

  t(key, fallback = '') {
    if (typeof this.translate !== 'function') {
      return fallback || key;
    }
    return this.translate(key, fallback);
  }

  renderEmptyState(query = '') {
    const wrap = document.createElement('div');
    wrap.className = 'menu-search__empty';

    const title = document.createElement('p');
    title.className = 'menu-search__empty-title';
    title.textContent = query
      ? this.t(
          'menu.search_no_results_title',
          'Keine passenden Ergebnisse gefunden',
        )
      : this.t('menu.search_empty_title', 'Website-Suche starten');
    wrap.appendChild(title);

    const description = document.createElement('p');
    description.className = 'menu-search__empty-text';
    description.textContent = this.t(
      'menu.search_empty_text',
      'Probiere Startseite, About, Blog oder Projekte.',
    );
    wrap.appendChild(description);

    const suggestionsWrap = document.createElement('div');
    suggestionsWrap.className = 'menu-search__empty-suggestions';

    const suggestions =
      typeof this.getFallbackSuggestions === 'function'
        ? this.getFallbackSuggestions()
        : [];
    suggestions.forEach((suggestion) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-search__empty-suggestion';
      btn.setAttribute('data-search-suggestion-url', suggestion.url);
      btn.textContent = suggestion.title;
      suggestionsWrap.appendChild(btn);
    });

    wrap.appendChild(suggestionsWrap);
    return wrap;
  }

  renderState(results, options = {}) {
    if (!results) return;

    const {
      hidden = false,
      loading = false,
      message = '',
      items = [],
      aiChatMessage = '',
      query = '',
      selectedIndex = -1,
      optionIdBuilder = (index) => `menu-search-results-option-${index}`,
    } = options;

    results.innerHTML = '';
    results.setAttribute('aria-busy', String(Boolean(loading)));

    if (hidden) {
      results.classList.remove('active');
      this.setPopupExpanded?.(false);
      return;
    }

    results.classList.add('active');
    this.setPopupExpanded?.(true);

    if (loading) {
      const skeleton = document.createElement('div');
      skeleton.className = 'menu-search__skeleton';
      for (let i = 0; i < 3; i += 1) {
        const row = document.createElement('div');
        row.className = 'menu-search__skeleton-row';
        row.innerHTML =
          '<div class="skeleton-title"></div><div class="skeleton-desc"></div>';
        skeleton.appendChild(row);
      }
      results.appendChild(skeleton);
      return;
    }

    if (aiChatMessage) {
      const aiChat = document.createElement('div');
      aiChat.className = 'menu-search__ai-chat';

      const aiText = document.createElement('div');
      aiText.className = 'menu-search__ai-text';
      aiText.innerHTML = aiChatMessage;
      aiChat.appendChild(aiText);

      results.appendChild(aiChat);
    }

    if (message) {
      const stateEl = document.createElement('div');
      stateEl.className = 'menu-search__state';
      stateEl.textContent = message;
      results.appendChild(stateEl);

      if (items.length === 0) {
        return;
      }
    }

    if (items.length === 0) {
      if (!aiChatMessage) {
        results.appendChild(this.renderEmptyState(query));
      }
      return;
    }

    const summary = document.createElement('div');
    summary.className = 'menu-search__count';

    const countText = document.createElement('span');
    countText.className = 'menu-search__count-value';
    countText.textContent = `${items.length} ${items.length === 1 ? 'Ergebnis' : 'Ergebnisse'}`;
    summary.appendChild(countText);

    const hintText = document.createElement('span');
    hintText.className = 'menu-search__count-hint';
    hintText.textContent = 'Enter oeffnen | Pfeile navigieren | Esc';
    summary.appendChild(hintText);

    results.appendChild(summary);

    const list = document.createElement('ul');
    list.className = 'menu-search__list';

    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'menu-search__item';
      li.style.setProperty('--search-item-index', index);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'menu-search__result';
      button.id = optionIdBuilder(index);
      button.setAttribute('data-search-index', String(index));
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(index === selectedIndex));

      if (index === selectedIndex) {
        button.classList.add('is-selected');
      }

      const badge = document.createElement('span');
      badge.className = 'menu-search__badge';
      badge.textContent =
        typeof this.getCategoryLabel === 'function'
          ? this.getCategoryLabel(item.category)
          : item.category || 'Seite';
      button.appendChild(badge);

      const heading = document.createElement('span');
      heading.className = 'menu-search__heading';

      const title = document.createElement('span');
      title.className = 'menu-search__title';
      title.textContent = item.title;
      heading.appendChild(title);

      const go = document.createElement('span');
      go.className = 'menu-search__go';
      go.setAttribute('aria-hidden', 'true');
      go.textContent = '›';
      heading.appendChild(go);

      button.appendChild(heading);

      const url = document.createElement('span');
      url.className = 'menu-search__url';
      url.textContent =
        typeof this.formatSearchResultUrl === 'function'
          ? this.formatSearchResultUrl(item.url)
          : String(item.url || '');
      button.appendChild(url);

      if (item.highlightedDescription) {
        const desc = document.createElement('span');
        desc.className = 'menu-search__desc';
        if (
          typeof this.hasMarkedHighlight === 'function' &&
          this.hasMarkedHighlight(item.highlightedDescription)
        ) {
          desc.innerHTML = item.highlightedDescription;
          button.appendChild(desc);
        }
      }

      li.appendChild(button);
      list.appendChild(li);
    });

    results.appendChild(list);
  }

  updateSelectionUI(results, input, selectedIndex) {
    if (!results) return;

    const optionEls = results.querySelectorAll('[data-search-index]');
    let activeOptionId = '';

    optionEls.forEach((el) => {
      const index = Number(el.getAttribute('data-search-index'));
      const isSelected = index === selectedIndex;
      el.classList.toggle('is-selected', isSelected);
      el.setAttribute('aria-selected', String(isSelected));

      if (isSelected) {
        activeOptionId = el.id || '';
        el.scrollIntoView({ block: 'nearest' });
      }
    });

    if (!input) return;

    if (activeOptionId) {
      input.setAttribute('aria-activedescendant', activeOptionId);
      return;
    }

    input.removeAttribute('aria-activedescendant');
  }
}

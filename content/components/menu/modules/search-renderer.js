export class MenuSearchRenderer {
  constructor(options = {}) {
    this.translate = options.translate;
    this.getCategoryLabel = options.getCategoryLabel;
    this.getFacetLabel = options.getFacetLabel;
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

  renderSuggestionChips(
    suggestions = [],
    className = 'menu-search__empty-suggestions',
  ) {
    const suggestionsWrap = document.createElement('div');
    suggestionsWrap.className = className;

    (Array.isArray(suggestions) ? suggestions : []).forEach((suggestion) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-search__empty-suggestion';
      btn.setAttribute('data-search-suggestion-url', suggestion.url);
      btn.textContent = suggestion.title;
      suggestionsWrap.appendChild(btn);
    });

    return suggestionsWrap;
  }

  renderEmptyState(query = '', providedSuggestions = []) {
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

    const suggestions =
      Array.isArray(providedSuggestions) && providedSuggestions.length > 0
        ? providedSuggestions
        : typeof this.getFallbackSuggestions === 'function'
          ? this.getFallbackSuggestions()
          : [];
    const suggestionChips = this.renderSuggestionChips(
      suggestions,
      'menu-search__empty-suggestions',
    );
    if (suggestionChips.children.length > 0) {
      wrap.appendChild(suggestionChips);
    }
    return wrap;
  }

  renderState(results, options = {}) {
    if (!results) return;

    const {
      hidden = false,
      loading = false,
      message = '',
      items = [],
      facet = 'all',
      facets = [],
      aiChatMessage = '',
      aiChatSuggestions = [],
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

      const suggestionChips = this.renderSuggestionChips(
        aiChatSuggestions,
        'menu-search__ai-suggestions',
      );
      if (suggestionChips.children.length > 0) {
        aiChat.appendChild(suggestionChips);
      }

      results.appendChild(aiChat);
    }

    if (query) {
      const facetBar = document.createElement('div');
      facetBar.className = 'menu-search__facets';

      (Array.isArray(facets) ? facets : []).forEach((entry) => {
        const facetKey = String(entry?.key || '').trim() || 'all';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'menu-search__facet';
        button.dataset.searchFacet = facetKey;
        button.dataset.active = String(facetKey === facet);
        if (facetKey === facet) {
          button.classList.add('is-active');
        }

        const label = document.createElement('span');
        label.className = 'menu-search__facet-label';
        label.textContent =
          typeof this.getFacetLabel === 'function'
            ? this.getFacetLabel(facetKey)
            : facetKey;

        const count = document.createElement('span');
        count.className = 'menu-search__facet-count';
        count.textContent = String(
          Math.max(0, Number.parseInt(String(entry?.count || 0), 10) || 0),
        );

        button.append(label, count);
        facetBar.appendChild(button);
      });

      if (facetBar.children.length > 0) {
        results.appendChild(facetBar);
      }
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
        results.appendChild(this.renderEmptyState(query, aiChatSuggestions));
      }
      return;
    }

    const summary = document.createElement('div');
    summary.className = 'menu-search__count';

    const countText = document.createElement('span');
    countText.className = 'menu-search__count-value';
    const activeFacetLabel =
      typeof this.getFacetLabel === 'function'
        ? this.getFacetLabel(facet)
        : facet;
    countText.textContent = `${items.length} ${items.length === 1 ? 'Ergebnis' : 'Ergebnisse'}${
      activeFacetLabel && facet !== 'all' ? ` in ${activeFacetLabel}` : ''
    }`;
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

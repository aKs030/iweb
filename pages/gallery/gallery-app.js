import { createLogger } from "../../content/utils/shared-utilities.js";

const log = createLogger("gallery-app");

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// Utility für Debouncing
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

// Lucide Icon Components (simplified inline versions)
const createIcon =
  (paths) =>
  ({ size = 20, className = "" } = {}) =>
    React.createElement(
      "svg",
      {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        className,
      },
      paths,
    );

const Heart = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement("path", {
      d: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
    }),
  ),
);

const X_Icon = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
    React.createElement("line", { x1: "6", y1: "6", x2: "18", y2: "18" }),
  ),
);

const ChevronLeft = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement("polyline", { points: "15 18 9 12 15 6" }),
  ),
);

const ChevronRight = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement("polyline", { points: "9 18 15 12 9 6" }),
  ),
);

const ZoomIn = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement("circle", { cx: "11", cy: "11", r: "8" }),
    React.createElement("line", {
      x1: "21",
      y1: "21",
      x2: "16.65",
      y2: "16.65",
    }),
    React.createElement("line", { x1: "11", y1: "8", x2: "11", y2: "14" }),
    React.createElement("line", { x1: "8", y1: "11", x2: "14", y2: "11" }),
  ),
);

const ZoomOut = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement("circle", { cx: "11", cy: "11", r: "8" }),
    React.createElement("line", {
      x1: "21",
      y1: "21",
      x2: "16.65",
      y2: "16.65",
    }),
    React.createElement("line", { x1: "8", y1: "11", x2: "14", y2: "11" }),
  ),
);

const Download = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement("path", {
      d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
    }),
    React.createElement("polyline", { points: "7 10 12 15 17 10" }),
    React.createElement("line", { x1: "12", y1: "15", x2: "12", y2: "3" }),
  ),
);

const Grid2x2 = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement("rect", { x: "3", y: "3", width: "7", height: "7" }),
    React.createElement("rect", { x: "14", y: "3", width: "7", height: "7" }),
    React.createElement("rect", { x: "14", y: "14", width: "7", height: "7" }),
    React.createElement("rect", { x: "3", y: "14", width: "7", height: "7" }),
  ),
);

const Grid3x3 = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement("rect", { x: "3", y: "3", width: "5", height: "5" }),
    React.createElement("rect", { x: "10", y: "3", width: "5", height: "5" }),
    React.createElement("rect", { x: "17", y: "3", width: "5", height: "5" }),
    React.createElement("rect", { x: "3", y: "10", width: "5", height: "5" }),
    React.createElement("rect", { x: "10", y: "10", width: "5", height: "5" }),
    React.createElement("rect", { x: "17", y: "10", width: "5", height: "5" }),
    React.createElement("rect", { x: "3", y: "17", width: "5", height: "5" }),
    React.createElement("rect", { x: "10", y: "17", width: "5", height: "5" }),
    React.createElement("rect", { x: "17", y: "17", width: "5", height: "5" }),
  ),
);

const Search = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement("circle", { cx: "11", cy: "11", r: "8" }),
    React.createElement("line", {
      x1: "21",
      y1: "21",
      x2: "16.65",
      y2: "16.65",
    }),
  ),
);

const Share2 = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement("circle", { cx: "18", cy: "5", r: "3" }),
    React.createElement("circle", { cx: "6", cy: "12", r: "3" }),
    React.createElement("circle", { cx: "18", cy: "19", r: "3" }),
    React.createElement("line", {
      x1: "8.59",
      y1: "13.51",
      x2: "15.42",
      y2: "17.49",
    }),
    React.createElement("line", {
      x1: "15.41",
      y1: "6.51",
      x2: "8.59",
      y2: "10.49",
    }),
  ),
);

const Play = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement("polygon", { points: "5 3 19 12 5 21 5 3" }),
  ),
);

const Pause = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement("rect", { x: "6", y: "4", width: "4", height: "16" }),
    React.createElement("rect", { x: "14", y: "4", width: "4", height: "16" }),
  ),
);

const Info = createIcon(
  React.createElement(
    React.Fragment,
    null,
    React.createElement("circle", { cx: "12", cy: "12", r: "10" }),
    React.createElement("line", { x1: "12", y1: "16", x2: "12", y2: "12" }),
    React.createElement("line", { x1: "12", y1: "8", x2: "12.01", y2: "8" }),
  ),
);

const PhotoGallery = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [filter, setFilter] = useState("all");
  const [zoom, setZoom] = useState(1);
  const [gridSize, setGridSize] = useState(3);
  const [imageLoaded, setImageLoaded] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [isSlideshow, setIsSlideshow] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [sortBy, setSortBy] = useState("date");
  const slideshowRef = useRef(null);

  const photos = [
    {
      id: 1,
      url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200",
      category: "nature",
      title: "Berglandschaft im Morgengrauen",
      tags: ["berge", "natur", "landschaft"],
      date: "2024-03-15",
      camera: "Canon EOS R5",
      aperture: "f/8",
      iso: "100",
      location: "Alpen",
    },
    {
      id: 2,
      url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200",
      category: "nature",
      title: "Mystischer Nebelwald",
      tags: ["wald", "nebel", "natur"],
      date: "2024-03-20",
      camera: "Sony A7III",
      aperture: "f/4",
      iso: "400",
      location: "Schwarzwald",
    },
    {
      id: 3,
      url: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1200",
      category: "urban",
      title: "Urbane Architektur",
      tags: ["stadt", "architektur", "modern"],
      date: "2024-02-10",
      camera: "Nikon Z9",
      aperture: "f/11",
      iso: "200",
      location: "Berlin",
    },
    {
      id: 4,
      url: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200",
      category: "nature",
      title: "Goldener Sonnenuntergang",
      tags: ["sunset", "himmel", "natur"],
      date: "2024-03-25",
      camera: "Fujifilm X-T5",
      aperture: "f/16",
      iso: "100",
      location: "Nordsee",
    },
    {
      id: 5,
      url: "https://images.unsplash.com/photo-1444464666168-49d633b86797?w=1200",
      category: "travel",
      title: "Reise ans Ende der Welt",
      tags: ["reise", "abenteuer", "landschaft"],
      date: "2024-01-15",
      camera: "Canon EOS R6",
      aperture: "f/5.6",
      iso: "800",
      location: "Island",
    },
    {
      id: 6,
      url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200",
      category: "nature",
      title: "Stille am Bergsee",
      tags: ["see", "berge", "ruhe"],
      date: "2024-03-18",
      camera: "Sony A7IV",
      aperture: "f/9",
      iso: "100",
      location: "Bayern",
    },
    {
      id: 7,
      url: "https://images.unsplash.com/photo-1477346611705-65d1883cee1e?w=1200",
      category: "travel",
      title: "Küstenstraße am Pazifik",
      tags: ["küste", "reise", "straße"],
      date: "2024-02-20",
      camera: "Canon EOS R5",
      aperture: "f/7.1",
      iso: "200",
      location: "Kalifornien",
    },
    {
      id: 8,
      url: "https://images.unsplash.com/photo-1511593358241-7eea1f3c84e5?w=1200",
      category: "urban",
      title: "Moderne Skyline",
      tags: ["architektur", "stadt", "skyline"],
      date: "2024-03-05",
      camera: "Nikon Z7",
      aperture: "f/8",
      iso: "400",
      location: "Frankfurt",
    },
    {
      id: 9,
      url: "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1200",
      category: "nature",
      title: "Unberührte Wildnis",
      tags: ["wildnis", "natur", "wald"],
      date: "2024-03-12",
      camera: "Fujifilm X-T4",
      aperture: "f/5.6",
      iso: "320",
      location: "Österreich",
    },
    {
      id: 10,
      url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=600",
      category: "landscape",
      title: "Panorama der Alpen",
      tags: ["panorama", "alpen", "weitwinkel"],
      date: "2024-03-22",
      camera: "Sony A1",
      aperture: "f/11",
      iso: "100",
      location: "Schweiz",
    },
    {
      id: 11,
      url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200",
      category: "nature",
      title: "Herbstlicher Waldweg",
      tags: ["herbst", "wald", "pfad"],
      date: "2024-02-28",
      camera: "Canon EOS R3",
      aperture: "f/4",
      iso: "250",
      location: "Thüringen",
    },
    {
      id: 12,
      url: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1200",
      category: "urban",
      title: "Nächtliche Stadtansicht",
      tags: ["nacht", "stadt", "lichter"],
      date: "2024-03-08",
      camera: "Sony A7SIII",
      aperture: "f/2.8",
      iso: "3200",
      location: "Hamburg",
    },
  ];

  const categories = ["all", "nature", "urban", "travel", "landscape"];

  // Debounce search query für bessere Performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Memoize gefilterte Fotos für bessere Performance
  const filteredPhotos = useMemo(() => {
    let result =
      filter === "all"
        ? photos
        : photos.filter((photo) => photo.category === filter);

    if (debouncedSearchQuery) {
      result = result.filter(
        (photo) =>
          photo.title
            .toLowerCase()
            .includes(debouncedSearchQuery.toLowerCase()) ||
          photo.tags.some((tag) =>
            tag.toLowerCase().includes(debouncedSearchQuery.toLowerCase()),
          ) ||
          photo.location
            .toLowerCase()
            .includes(debouncedSearchQuery.toLowerCase()),
      );
    }

    return [...result].sort((a, b) => {
      if (sortBy === "date") return new Date(b.date) - new Date(a.date);
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "popular") return favorites.includes(b.id) ? 1 : -1;
      return 0;
    });
  }, [filter, debouncedSearchQuery, sortBy, favorites]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedImage) return;

      if (e.key === "Escape") {
        setSelectedImage(null);
        setZoom(1);
        setIsSlideshow(false);
      } else if (e.key === "ArrowLeft") {
        navigateImage(-1);
      } else if (e.key === "ArrowRight") {
        navigateImage(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImage]);

  useEffect(() => {
    if (isSlideshow && selectedImage) {
      slideshowRef.current = setTimeout(() => {
        navigateImage(1);
      }, 3000);
    }
    return () => {
      if (slideshowRef.current) clearTimeout(slideshowRef.current);
    };
  }, [isSlideshow, selectedImage]);

  // Focus trap for the lightbox modal
  useEffect(() => {
    let prevActive = null;
    const focusableSelector =
      'a[href], area[href], input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]';

    function getFocusableElements(modal) {
      const nodes = modal.querySelectorAll(focusableSelector);
      return Array.prototype.slice.call(nodes);
    }

    function handleKeyTrap(e) {
      if (e.key === "Escape") {
        setSelectedImage(null);
      }
      if (e.key === "Tab") {
        const modal = document.getElementById("lightbox");
        if (!modal) return;
        const focusable = getFocusableElements(modal);
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!modal.contains(document.activeElement)) {
          first.focus();
          e.preventDefault();
          return;
        }
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
          return;
        }
        if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
          return;
        }
      }
    }

    if (selectedImage) {
      prevActive = document.activeElement;
      const closeBtn = document.getElementById("lightbox-close");
      const mainEl = document.querySelector("main");
      if (mainEl) mainEl.setAttribute("aria-hidden", "true");
      setTimeout(() => {
        if (closeBtn) closeBtn.focus();
      }, 0);
      document.addEventListener("keydown", handleKeyTrap);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyTrap);
      const mainEl = document.querySelector("main");
      if (mainEl) mainEl.removeAttribute("aria-hidden");
      setTimeout(() => {
        try {
          if (prevActive && typeof prevActive.focus === "function")
            prevActive.focus();
        } catch (err) {
          log.warn("GalleryApp: restoring focus failed", err);
        }
      }, 0);
    };
  }, [selectedImage]);

  const navigateImage = useCallback(
    (direction) => {
      const currentIndex = filteredPhotos.findIndex(
        (p) => p.id === selectedImage.id,
      );
      const newIndex =
        (currentIndex + direction + filteredPhotos.length) %
        filteredPhotos.length;
      setSelectedImage(filteredPhotos[newIndex]);
      setZoom(1);
    },
    [selectedImage, filteredPhotos],
  );

  const handleZoom = useCallback((delta) => {
    setZoom((prev) => Math.max(0.5, Math.min(3, prev + delta)));
  }, []);

  const handleDownload = useCallback(() => {
    const link = document.createElement("a");
    link.href = selectedImage.url;
    link.download = `${selectedImage.title}.jpg`;
    link.click();
  }, [selectedImage]);

  const toggleFavorite = useCallback((id, e) => {
    e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((fav) => fav !== id) : [...prev, id],
    );
  }, []);

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: selectedImage.title,
        text: `Schau dir dieses tolle Foto an: ${selectedImage.title}`,
        url: selectedImage.url,
      });
    }
  }, [selectedImage]);

  const gridCols =
    gridSize === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return React.createElement(
    "div",
    { className: "min-h-screen p-4 sm:p-8" },
    React.createElement(
      "div",
      { className: "max-w-7xl mx-auto mb-8" },
      React.createElement(
        "div",
        { className: "text-center mb-8" },
        React.createElement(
          "h1",
          {
            className:
              "text-5xl sm:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 mb-3",
          },
          "Premium Fotogalerie",
        ),
        React.createElement(
          "p",
          { className: "text-indigo-200 text-lg" },
          "Professionelle Fotografie in höchster Qualität",
        ),
      ),
      React.createElement(
        "div",
        { className: "max-w-2xl mx-auto mb-8" },
        React.createElement(
          "div",
          { className: "relative" },
          Search({
            className:
              "absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300",
            size: 20,
          }),
          React.createElement("input", {
            type: "text",
            placeholder: "Suche nach Titel, Tags oder Orten...",
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            className:
              "w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all",
          }),
        ),
      ),
      React.createElement(
        "div",
        {
          className:
            "flex flex-col lg:flex-row justify-between items-center gap-4 mb-6",
        },
        React.createElement(
          "div",
          { className: "flex gap-2 flex-wrap justify-center" },
          categories.map((cat) =>
            React.createElement(
              "button",
              {
                key: cat,
                onClick: () => setFilter(cat),
                "data-filter": cat,
                className: `px-5 py-2.5 rounded-xl font-medium transition-all duration-300 ${
                  filter === cat
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/50 scale-105"
                    : "bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm border border-white/10"
                }`,
              },
              cat.charAt(0).toUpperCase() + cat.slice(1),
            ),
          ),
        ),
        React.createElement(
          "div",
          { className: "flex gap-3 items-center" },
          React.createElement(
            "select",
            {
              value: sortBy,
              onChange: (e) => setSortBy(e.target.value),
              className:
                "px-4 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500",
            },
            React.createElement(
              "option",
              { value: "date", className: "bg-slate-900" },
              "Neueste",
            ),
            React.createElement(
              "option",
              { value: "title", className: "bg-slate-900" },
              "Titel",
            ),
            React.createElement(
              "option",
              { value: "popular", className: "bg-slate-900" },
              "Beliebt",
            ),
          ),
          React.createElement(
            "div",
            {
              className:
                "flex gap-2 bg-white/10 backdrop-blur-sm rounded-xl p-1 border border-white/20",
            },
            React.createElement(
              "button",
              {
                onClick: () => setGridSize(2),
                className: `p-2 rounded-lg transition-all ${gridSize === 2 ? "bg-purple-500 text-white" : "text-white hover:bg-white/10"}`,
              },
              Grid2x2({ size: 18 }),
            ),
            React.createElement(
              "button",
              {
                onClick: () => setGridSize(3),
                className: `p-2 rounded-lg transition-all ${gridSize === 3 ? "bg-purple-500 text-white" : "text-white hover:bg-white/10"}`,
              },
              Grid3x3({ size: 18 }),
            ),
          ),
        ),
      ),
      React.createElement(
        "div",
        { className: "text-center text-indigo-300 mb-6" },
        `${filteredPhotos.length} ${filteredPhotos.length === 1 ? "Foto" : "Fotos"} gefunden`,
      ),
    ),
    React.createElement(
      "div",
      { className: `max-w-7xl mx-auto grid ${gridCols} gap-6` },

      filteredPhotos.map((photo, index) =>
        React.createElement(
          "div",
          {
            key: photo.id,
            "data-test": "photo-card",
            className:
              "group relative overflow-hidden rounded-2xl cursor-pointer transform transition-all duration-500 hover:scale-[1.03] hover:shadow-2xl hover:shadow-purple-500/40 hover:z-10",
            style: {
              animation: `fadeInScale 0.6s ease-out ${index * 0.05}s both`,
            },
            role: "button",
            tabIndex: 0,
            onClick: () => {
              setSelectedImage(photo);
              setZoom(1);
            },
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedImage(photo);
                setZoom(1);
              }
            },
          },
          React.createElement(
            "div",
            {
              className:
                "aspect-[4/3] bg-slate-800/50 backdrop-blur-sm relative",
            },
            React.createElement("img", {
              src: photo.url,
              alt: photo.title,
              loading: "lazy",
              decoding: "async",
              className:
                "w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:brightness-110",
              onLoad: () =>
                setImageLoaded((prev) => ({ ...prev, [photo.id]: true })),
            }),
            React.createElement("div", {
              className:
                "absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60",
            }),
          ),
          React.createElement(
            "div",
            {
              className:
                "absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-between p-6",
            },
            React.createElement(
              "div",
              { className: "flex justify-between items-start" },
              React.createElement(
                "span",
                {
                  className:
                    "px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-white text-xs font-medium border border-white/30",
                },
                photo.category,
              ),
              React.createElement(
                "button",
                {
                  onClick: (e) => toggleFavorite(photo.id, e),
                  className:
                    "p-2 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/30 transition-all",
                },
                Heart({
                  size: 18,
                  className: `${favorites.includes(photo.id) ? "fill-red-500 text-red-500" : "text-white"}`,
                }),
              ),
            ),
            React.createElement(
              "div",
              null,
              React.createElement(
                "h3",
                { className: "text-white text-xl font-bold mb-2" },
                photo.title,
              ),
              React.createElement(
                "div",
                {
                  className: "flex items-center gap-3 text-indigo-200 text-sm",
                },
                React.createElement("span", null, photo.camera),
                React.createElement("span", null, "•"),
                React.createElement("span", null, photo.location),
              ),
            ),
          ),
          !imageLoaded[photo.id] &&
            React.createElement(
              "div",
              {
                className:
                  "absolute inset-0 bg-slate-900 flex items-center justify-center",
              },
              React.createElement(
                "div",
                { className: "relative" },
                React.createElement("div", {
                  className:
                    "w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin",
                }),
                React.createElement(
                  "div",
                  {
                    className:
                      "absolute inset-0 flex items-center justify-center",
                  },
                  React.createElement("div", {
                    className:
                      "w-8 h-8 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin",
                    style: { animationDirection: "reverse" },
                  }),
                ),
              ),
            ),
        ),
      ),
    ),
    selectedImage &&
      React.createElement(
        "div",
        {
          id: "lightbox",
          "data-test": "lightbox",
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "lightbox-title",
          className:
            "fixed inset-0 bg-black/98 backdrop-blur-sm z-50 flex items-center justify-center",
          onClick: () => {
            setSelectedImage(null);
            setZoom(1);
            setIsSlideshow(false);
          },
        },
        React.createElement(
          "div",
          {
            className:
              "absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/80 to-transparent z-10",
          },
          React.createElement(
            "div",
            {
              className: "max-w-7xl mx-auto flex justify-between items-center",
            },
            React.createElement(
              "div",
              { className: "text-white" },
              React.createElement(
                "h2",
                { id: "lightbox-title", className: "text-2xl font-bold mb-1" },
                selectedImage.title,
              ),
              React.createElement(
                "p",
                { className: "text-indigo-300" },
                `${selectedImage.location} • ${new Date(selectedImage.date).toLocaleDateString("de-DE")}`,
              ),
            ),
            React.createElement(
              "div",
              { className: "flex gap-2" },
              React.createElement(
                "button",
                {
                  onClick: (e) => {
                    e.stopPropagation();
                    setShowInfo(!showInfo);
                  },
                  className: `p-3 rounded-xl transition-all backdrop-blur-md ${showInfo ? "bg-purple-500" : "bg-white/10 hover:bg-white/20"}`,
                },
                Info({ size: 20, className: "text-white" }),
              ),
              React.createElement(
                "button",
                {
                  onClick: (e) => {
                    e.stopPropagation();
                    setIsSlideshow(!isSlideshow);
                  },
                  className: `p-3 rounded-xl transition-all backdrop-blur-md ${isSlideshow ? "bg-purple-500" : "bg-white/10 hover:bg-white/20"}`,
                },
                isSlideshow
                  ? Pause({ size: 20, className: "text-white" })
                  : Play({ size: 20, className: "text-white" }),
              ),
              React.createElement(
                "button",
                {
                  id: "lightbox-close",
                  onClick: (e) => {
                    e.stopPropagation();
                    setSelectedImage(null);
                    setZoom(1);
                    setIsSlideshow(false);
                  },
                  className:
                    "p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all backdrop-blur-md",
                },
                X_Icon({ size: 20, className: "text-white" }),
              ),
            ),
          ),
        ),
        showInfo &&
          React.createElement(
            "div",
            {
              className:
                "absolute top-24 right-6 w-80 bg-black/90 backdrop-blur-xl rounded-2xl p-6 border border-white/10 z-10",
            },
            React.createElement(
              "h3",
              { className: "text-white font-bold text-lg mb-4" },
              "Foto-Details",
            ),
            React.createElement(
              "div",
              { className: "space-y-3 text-sm" },
              React.createElement(
                "div",
                { className: "flex justify-between" },
                React.createElement(
                  "span",
                  { className: "text-indigo-300" },
                  "Kamera:",
                ),
                React.createElement(
                  "span",
                  { className: "text-white font-medium" },
                  selectedImage.camera,
                ),
              ),
              React.createElement(
                "div",
                { className: "flex justify-between" },
                React.createElement(
                  "span",
                  { className: "text-indigo-300" },
                  "Blende:",
                ),
                React.createElement(
                  "span",
                  { className: "text-white font-medium" },
                  selectedImage.aperture,
                ),
              ),
              React.createElement(
                "div",
                { className: "flex justify-between" },
                React.createElement(
                  "span",
                  { className: "text-indigo-300" },
                  "ISO:",
                ),
                React.createElement(
                  "span",
                  { className: "text-white font-medium" },
                  selectedImage.iso,
                ),
              ),
              React.createElement(
                "div",
                { className: "flex justify-between" },
                React.createElement(
                  "span",
                  { className: "text-indigo-300" },
                  "Ort:",
                ),
                React.createElement(
                  "span",
                  { className: "text-white font-medium" },
                  selectedImage.location,
                ),
              ),
              React.createElement(
                "div",
                { className: "flex justify-between" },
                React.createElement(
                  "span",
                  { className: "text-indigo-300" },
                  "Datum:",
                ),
                React.createElement(
                  "span",
                  { className: "text-white font-medium" },
                  new Date(selectedImage.date).toLocaleDateString("de-DE"),
                ),
              ),
              React.createElement(
                "div",
                { className: "pt-3 border-t border-white/10" },
                React.createElement(
                  "span",
                  { className: "text-indigo-300 block mb-2" },
                  "Tags:",
                ),
                React.createElement(
                  "div",
                  { className: "flex flex-wrap gap-2" },
                  selectedImage.tags.map((tag) =>
                    React.createElement(
                      "span",
                      {
                        key: tag,
                        className:
                          "px-2 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-xs",
                      },
                      `#${tag}`,
                    ),
                  ),
                ),
              ),
            ),
          ),
        React.createElement(
          "button",
          {
            onClick: (e) => {
              e.stopPropagation();
              navigateImage(-1);
            },
            className:
              "absolute left-6 top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/20 rounded-full transition-all backdrop-blur-md z-10 group",
          },
          ChevronLeft({
            size: 32,
            className: "text-white group-hover:scale-110 transition-transform",
          }),
        ),
        React.createElement(
          "button",
          {
            onClick: (e) => {
              e.stopPropagation();
              navigateImage(1);
            },
            className:
              "absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-white/10 hover:bg-white/20 rounded-full transition-all backdrop-blur-md z-10 group",
          },
          ChevronRight({
            size: 32,
            className: "text-white group-hover:scale-110 transition-transform",
          }),
        ),
        React.createElement(
          "div",
          {
            className:
              "absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 bg-black/80 backdrop-blur-xl rounded-2xl p-3 border border-white/10",
          },
          React.createElement(
            "button",
            {
              onClick: (e) => {
                e.stopPropagation();
                handleZoom(-0.25);
              },
              className: "p-3 hover:bg-white/10 rounded-xl transition-all",
            },
            ZoomOut({ size: 20, className: "text-white" }),
          ),
          React.createElement(
            "div",
            {
              className:
                "px-4 py-3 text-white font-semibold min-w-[80px] text-center bg-white/5 rounded-xl",
            },
            `${Math.round(zoom * 100)}%`,
          ),
          React.createElement(
            "button",
            {
              onClick: (e) => {
                e.stopPropagation();
                handleZoom(0.25);
              },
              className: "p-3 hover:bg-white/10 rounded-xl transition-all",
            },
            ZoomIn({ size: 20, className: "text-white" }),
          ),
          React.createElement("div", { className: "w-px bg-white/20" }),
          React.createElement(
            "button",
            {
              onClick: (e) => {
                e.stopPropagation();
                toggleFavorite(selectedImage.id, e);
              },
              className: "p-3 hover:bg-white/10 rounded-xl transition-all",
            },
            Heart({
              size: 20,
              className: `${favorites.includes(selectedImage.id) ? "fill-red-500 text-red-500" : "text-white"}`,
            }),
          ),
          React.createElement(
            "button",
            {
              onClick: (e) => {
                e.stopPropagation();
                handleShare();
              },
              className: "p-3 hover:bg-white/10 rounded-xl transition-all",
            },
            Share2({ size: 20, className: "text-white" }),
          ),
          React.createElement(
            "button",
            {
              onClick: (e) => {
                e.stopPropagation();
                handleDownload();
              },
              className: "p-3 hover:bg-white/10 rounded-xl transition-all",
            },
            Download({ size: 20, className: "text-white" }),
          ),
        ),
        React.createElement(
          "div",
          {
            className: "relative max-w-full max-h-full overflow-hidden",
            onClick: (e) => e.stopPropagation(),
          },
          React.createElement("img", {
            src: selectedImage.url,
            alt: selectedImage.title,
            className:
              "max-w-full max-h-[80vh] object-contain transition-all duration-300",
            style: {
              transform: `scale(${zoom})`,
              filter: "drop-shadow(0 25px 50px rgba(0,0,0,0.5))",
            },
          }),
        ),
        isSlideshow &&
          React.createElement(
            "div",
            {
              className:
                "absolute bottom-32 left-1/2 -translate-x-1/2 w-64 h-1 bg-white/20 rounded-full overflow-hidden",
            },
            React.createElement("div", {
              className:
                "h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full",
              style: {
                animation: "progress 3s linear infinite",
              },
            }),
          ),
        React.createElement(
          "style",
          null,
          `
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        @keyframes progress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
      `,
        ),
      ),
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(PhotoGallery));

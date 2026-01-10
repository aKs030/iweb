/**
 * Blog Content Data
 * A list of professional articles for the portfolio blog.
 */

export const blogPosts = [
  {
    id: 'threejs-performance',
    title: 'Optimierung von Three.js für das Web',
    date: '15. Dezember 2025',
    category: 'Development',
    excerpt:
      'Wie man komplexe 3D-Szenen performant im Browser rendert, ohne den Akku mobiler Geräte zu belasten.',
    content:
      'Three.js ist ein mächtiges Werkzeug, aber mit großer Macht kommt große Verantwortung. In diesem Artikel erkläre ich Techniken wie InstancedMesh, Shader-Optimierung und effizientes Memory-Management, um flüssige 60 FPS auch auf Mittelklasse-Smartphones zu erreichen. Der Schlüssel liegt oft in der Reduktion von Draw Calls und der Verlagerung von Berechnungen auf die GPU via Custom Shaders.',
    tags: ['Three.js', 'WebGL', 'Performance'],
    readTime: '5 min',
    author: 'Abdulkerim Sesli (Abdul Berlin)',
    image: 'https://abdulkerimsesli.de/content/assets/img/og/og-threejs.png',
  },
  {
    id: 'visual-storytelling',
    title: 'Visuelles Storytelling in der Fotografie',
    date: '2. November 2025',
    category: 'Photography',
    excerpt:
      'Warum Komposition wichtiger ist als die Kamera. Ein Einblick in meine Herangehensweise bei Urban Photography.',
    content:
      'Jedes Bild erzählt eine Geschichte, aber nur, wenn die Komposition stimmt. Ich teile meine Erfahrungen mit Leading Lines, Negative Space und der Drittel-Regel, um den Blick des Betrachters gezielt zu lenken. Es geht nicht um die Megapixel, sondern um das Gefühl, das ein Bild transportiert.',
    tags: ['Photography', 'Composition', 'Art'],
    readTime: '4 min',
    author: 'Abdulkerim Sesli (Abdul Berlin)',
    image:
      'https://abdulkerimsesli.de/content/assets/img/og/og-photography.png',
  },
  {
    id: 'modern-ui-design',
    title: 'Modernes UI-Design: Mehr als nur Dark Mode',
    date: '10. Oktober 2025',
    category: 'Design',
    excerpt:
      'Warum Barrierefreiheit und Mikro-Interaktionen den Unterschied machen.',
    content:
      'Ein gutes UI sieht nicht nur gut aus, es fühlt sich auch gut an. Durch subtile Animationen und klares Feedback schaffen wir eine intuitive User Experience. Gleichzeitig darf Accessibility kein Nachgedanke sein – semantisches HTML und ausreichende Kontraste sind das Fundament jeder professionellen Web-Anwendung.',
    tags: ['UI/UX', 'Accessibility', 'Design'],
    readTime: '6 min',
    author: 'Abdulkerim Sesli (Abdul Berlin)',
    image: 'https://abdulkerimsesli.de/content/assets/img/og/og-design.png',
  },
  {
    id: 'react-no-build',
    title: 'React ohne Build-Tools nutzen',
    date: '5. September 2025',
    category: 'Development',
    excerpt:
      'Wie man moderne Frameworks in statischen Seiten einsetzt, ohne komplexe Toolchains zu benötigen.',
    content:
      'Oft ist ein komplexes Setup mit Webpack oder Vite gar nicht nötig. Mit modernen Browser-Features wie ES Modules und Tools wie `htm` können wir React direkt im Browser nutzen. Das reduziert die Komplexität und beschleunigt den Entwicklungsprozess für kleinere Projekte oder Prototypen enorm.',
    tags: ['React', 'JavaScript', 'No-Build'],
    readTime: '3 min',
    author: 'Abdulkerim Sesli (Abdul Berlin)',
    image: 'https://abdulkerimsesli.de/content/assets/img/og/og-react.png',
  },
];

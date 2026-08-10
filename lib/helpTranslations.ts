import type { Locale } from "./i18n";

export interface HelpTranslation {
  modalTitle: string;
  modalSubtitle: string;
  gotItBtn: string;
  categories: {
    brushesTitle: string;
    brushesDesc: string;
    textShapesTitle: string;
    textShapesDesc: string;
    creativeToolsTitle: string;
    creativeToolsDesc: string;
    collabTitle: string;
    collabDesc: string;
    navTimeTitle: string;
    navTimeDesc: string;
    shieldTitle: string;
    shieldDesc: string;
  };
  shortcutsTitle: string;
  panLabel: string;
  panDesc: string;
  zoomLabel: string;
  zoomDesc: string;
}

export const HELP_TRANSLATIONS: Record<Locale, HelpTranslation> = {
  en: {
    modalTitle: "AlwaysDraw — Features & Usage Guide",
    modalSubtitle: "One world. One canvas. Always drawing.",
    gotItBtn: "GOT IT, LET'S DRAW!",
    categories: {
      brushesTitle: "🎨 Brushes & Color System",
      brushesDesc: "Choose from 12 brush textures (Pencil, Marker, Calligraphy, Pixel, Watercolor, Oil, Chalk, Charcoal, Glitter, Neon Glow). Use the Eyedropper (I) or Hex picker for custom colors.",
      textShapesTitle: "✍️ Vector Text & 8 Shapes",
      textShapesDesc: "Type vector text (X) in 5 typography styles (Sans, Mono, Pixel, Serif, Script). Draw 8 geometric shapes (Line, Arrow, Square, Circle, Triangle, Star, Hexagon, Heart).",
      creativeToolsTitle: "🪄 Fill Bucket & Stickers",
      creativeToolsDesc: "Tap to flood fill enclosed areas (F). Stamp retro sprites/emojis, spray stencils (T), measure distances (R), or shine laser trails (L).",
      collabTitle: "👥 Real-Time Multiplayer & Sticky Notes",
      collabDesc: "Live stroke synchronization with online artists. View remote cursors with country flags. Drop interactive Sticky Note comments (C) anywhere on the wall.",
      navTimeTitle: "🗺️ MiniMap, Heatmap & Time Travel",
      navTimeDesc: "Focal-point pan & zoom. Click-to-teleport MiniMap, activity density heatmap (G), saved bookmarks with URL sharing, and stroke-by-stroke Time Travel replay.",
      shieldTitle: "🛡️ Mural Shield & Moderation",
      shieldDesc: "Admin Protected Zones (Mural Shield) lock designated artwork from overwriting. Admin panel enables image stamping, area wipe, and client rollback.",
    },
    shortcutsTitle: "Navigation & Quick Shortcuts",
    panLabel: "Pan Camera",
    panDesc: "Space + Drag, Hand tool (H), or 2-finger touch drag",
    zoomLabel: "Zoom Camera",
    zoomDesc: "Mouse wheel, Pinch-to-zoom, or Toolbar +/- buttons",
  },
  fr: {
    modalTitle: "AlwaysDraw — Guide des Fonctionnalités",
    modalSubtitle: "Un monde. Une toile. Toujours en dessin.",
    gotItBtn: "COMPRIS, DESSINONS !",
    categories: {
      brushesTitle: "🎨 Pinceaux & Système de Couleurs",
      brushesDesc: "12 textures de pinceaux (Crayon, Feutre, Calligraphie, Pixel, Aquarelle, Huile, Craie, Carbon, Paillettes, Néon). Pipette (I) et sélecteur Hex disponibles.",
      textShapesTitle: "✍️ Texte Vectoriel & 8 Formes",
      textShapesDesc: "Saisissez du texte vectoriel (X) en 5 polices (Sans, Mono, Pixel, Serif, Script). Tracez 8 formes (Ligne, Flèche, Carré, Cercle, Triangle, Étoile, Hexagone, Cœur).",
      creativeToolsTitle: "🪄 Remplissage & Autocollants",
      creativeToolsDesc: "Remplissage par pot de peinture (F). Tamponnez des stickers rétro, meurez avec la règle (R), pochoirs (T) ou laser (L).",
      collabTitle: "👥 Multijoueur & Notes Reconnectées",
      collabDesc: "Synchronisation en direct. Curseurs distants avec drapeaux nationaux. Déposez des notes adhésives interactives (C) sur le mur.",
      navTimeTitle: "🗺️ MiniCarte, Carte Thermique & Voyage Temporel",
      navTimeDesc: "Panoramique et zoom. MiniCarte avec téléportation, carte d'activité (G), signets d'URL et relecture temporelle stroke par stroke.",
      shieldTitle: "🛡️ Bouclier Mural & Modération",
      shieldDesc: "Zones protégées (Mural Shield) verrouillant les œuvres. Panneau d'administration pour le tampon d'images et l'annulation.",
    },
    shortcutsTitle: "Navigation & Raccourcis",
    panLabel: "Déplacer la Caméra",
    panDesc: "Espace + Glisser, Outil Main (H), ou glissement à 2 doigts",
    zoomLabel: "Zoomer",
    zoomDesc: "Molette de souris, pincement tactile, ou boutons +/-",
  },
  ar: {
    modalTitle: "AlwaysDraw — دليل الميزات والاستخدام",
    modalSubtitle: "عالم واحد. لوحة واحدة. رسم مستمر.",
    gotItBtn: "فهمت، لنبدأ الرسم!",
    categories: {
      brushesTitle: "🎨 الفرش ونظام الألوان",
      brushesDesc: "اختر من بين 12 قوامًا للفرشاة (قلم رصاص، ماكر، خط، بكسل، ألوان مائية، زيت، طبشور، فحم، بريق، نيون). استخدم أداة القطارة (I) واختيار الألوان.",
      textShapesTitle: "✍️ نص متجهات و 8 أشكال",
      textShapesDesc: "اكتب نصوصًا متجهة (X) بـ 5 خطوط. ارسم 8 أشكال هندسية (خط، سهم، مربع، دائرة، مثلث، نجمة، مسدس، قلب).",
      creativeToolsTitle: "🪄 التعبئة والملصقات",
      creativeToolsDesc: "تعبئة سريعة (F). ضع ملصقات ريترو، استخدم المسطرة (R)، الاستنسل (T) والليزر (L).",
      collabTitle: "👥 الرسم الجماعي واللاحظات اللاصقة",
      collabDesc: "مزامنة فورية للرسم مع جميع اللاعبين. مؤشرات الماوس المباشرة مع أعلام الدول. أضف ملاحظات لاصقة تفاعلية (C).",
      navTimeTitle: "🗺️ الخريطة المصغرة، الحرارية والسفر عبر الزمن",
      navTimeDesc: "تكبير وتكبير بؤري. خريطة للتنقل المباشر، خريطة الكثافة (G)، الإشارات المرجعية وإعادة تشغيل السجل خطوة بخطوة.",
      shieldTitle: "🛡️ درع الجدارية والإدارة",
      shieldDesc: "مناطق محمية لحظر التعديل على الأعمال الفنية. لوحة الإدارة لختم الصور والتراجع.",
    },
    shortcutsTitle: "التنقل والاختصارات السريعة",
    panLabel: "تحريك الكاميرا",
    panDesc: "مسافة + سحب، أداة اليد (H)، أو سحب بإصبعين",
    zoomLabel: "التكبير والتصغير",
    zoomDesc: "عجلة الماوس، اللمس بالقرص، أو أزرار +/-",
  },
  ru: {
    modalTitle: "AlwaysDraw — Руководство по функциям",
    modalSubtitle: "Один мир. Один холст. Постоянное рисование.",
    gotItBtn: "ПОНЯТНО, РИСУЕМ!",
    categories: {
      brushesTitle: "🎨 Кисти и система цвета",
      brushesDesc: "12 текстур кистей (Карандаш, Маркер, Каллиграфия, Пиксель, Акварель, Масло, Мел, Уголь, Блестки, Неон). Пипетка (I) и Hex-выбор цвета.",
      textShapesTitle: "✍️ Векторный текст и 8 фигур",
      textShapesDesc: "Печатайте векторный текст (X) 5 стилями шрифтов. Рисуйте 8 геометрических фигур (Линия, Стрелка, Квадрат, Круг, Треугольник, Звезда, Шестиугольник, Сердце).",
      creativeToolsTitle: "🪄 Заливка и Стикеры",
      creativeToolsDesc: "Быстрая заливка областей (F). Стикеры, линейка (R), трафареты (T) и лазерный след (L).",
      collabTitle: "👥 Совместное рисование и Заметки",
      collabDesc: "Мгновенная синхронизация штрихов. Живые курсоры пользователей с флагами стран. Оставляйте стикеры-заметки (C) на стене.",
      navTimeTitle: "🗺️ Мини-карта, Тепловая карта и Путешествие во времени",
      navTimeDesc: "Масштабирование и панорамирование. Мини-карта с телепортацией, карта активности (G), закладки и воспроизведение истории.",
      shieldTitle: "🛡️ Защитный щит холста и Модерация",
      shieldDesc: "Защищенные зоны (Mural Shield) блокируют перезапись рисунков. Панель админа для штамповки изображений и отката.",
    },
    shortcutsTitle: "Навигация и Горячие клавиши",
    panLabel: "Перемещение камеры",
    panDesc: "Пробел + Перетаскивание, Инструмент Рука (H) или 2 пальца",
    zoomLabel: "Масштаб",
    zoomDesc: "Колесо мыши, жест сведением пальцев или кнопки +/-",
  },
  es: {
    modalTitle: "AlwaysDraw — Guía de Funciones y Uso",
    modalSubtitle: "Un mundo. Un lienzo. Siempre dibujando.",
    gotItBtn: "¡ENTENDIDO, A DIBUJAR!",
    categories: {
      brushesTitle: "🎨 Pinceles y Sistema de Color",
      brushesDesc: "12 texturas de pincel (Lápiz, Marcador, Caligrafía, Píxel, Acuarela, Óleo, Tiza, Carbón, Purpurina, Neón). Cuentagotas (I) y selector Hex.",
      textShapesTitle: "✍️ Texto Vectorial y 8 Formas",
      textShapesDesc: "Escribe texto vectorial (X) en 5 fuentes. Dibuja 8 formas geométricas (Línea, Flecha, Cuadrado, Círculo, Triángulo, Estrella, Hexágono, Corazón).",
      creativeToolsTitle: "🪄 Relleno y Pegatinas",
      creativeToolsDesc: "Relleno de pintura (F). Pega pegatinas retro, mide con la regla (R), plantillas (T) y láser (L).",
      collabTitle: "👥 Multijugador y Notas Adhesivas",
      collabDesc: "Sincronización en directo. Cursores remotos con banderas de países. Deja notas adhesivas interactivas (C) en la pared.",
      navTimeTitle: "🗺️ Minimapa, Mapa de Calor y Viaje en el Tiempo",
      navTimeDesc: "Desplazamiento y zoom focal. Minimapa con teletransporte, mapa de actividad (G), marcadores de URL y reproducción en el tiempo.",
      shieldTitle: "🛡️ Escudo del Mural y Moderación",
      shieldDesc: "Zonas protegidas (Mural Shield) para bloquear sobreescrituras. Panel de administración para estampar imágenes y revertir.",
    },
    shortcutsTitle: "Navegación y Atajos Rápidos",
    panLabel: "Mover Cámara",
    panDesc: "Espacio + Arrastrar, Herramienta Mano (H) o 2 dedos",
    zoomLabel: "Zoom",
    zoomDesc: "Rueda del ratón, pellizcar en pantalla táctil o botones +/-",
  },
  pt: {
    modalTitle: "AlwaysDraw — Guia de Funcionalidades",
    modalSubtitle: "Um mundo. Uma tela. Sempre a desenhar.",
    gotItBtn: "ENTENDIDO, VAMOS DESENHAR!",
    categories: {
      brushesTitle: "🎨 Pincéis e Sistema de Cor",
      brushesDesc: "12 texturas de pincel (Lápis, Marcador, Caligrafia, Píxel, Aguarela, Óleo, Giz, Carvão, Brilho, Neon). Conta-gotas (I) e seletor Hex.",
      textShapesTitle: "✍️ Texto Vectorial e 8 Formas",
      textShapesDesc: "Escreva texto vectorial (X) em 5 fontes. Desenhe 8 formas geométricas (Linha, Seta, Quadrado, Círculo, Triângulo, Estrela, Hexágono, Coração).",
      creativeToolsTitle: "🪄 Preenchimento e Autocolantes",
      creativeToolsDesc: "Preenchimento por balde (F). Cole autocolantes retro, meça com a régua (R), moldes (T) e laser (L).",
      collabTitle: "👥 Multijogador e Notas Colantes",
      collabDesc: "Sincronização em direto. Cursores remotos com bandeiras de países. Deixe notas colantes interativas (C) na parede.",
      navTimeTitle: "🗺️ Minimapa, Mapa de Calor e Viagem no Tempo",
      navTimeDesc: "Navegação e zoom focal. Minimapa com teletransporte, mapa de atividade (G), marcadores e reprodução histórica no tempo.",
      shieldTitle: "🛡️ Escudo Mural e Moderação",
      shieldDesc: "Zonas protegidas (Mural Shield) para bloquear edições. Painel de administração para carimbar imagens e reverter.",
    },
    shortcutsTitle: "Navegação e Atalhos Rápidos",
    panLabel: "Mover Câmara",
    panDesc: "Espaço + Arrastar, Ferramenta Mão (H) ou 2 dedos",
    zoomLabel: "Zoom",
    zoomDesc: "Roda do rato, pinça no ecrã tátil ou botões +/-",
  },
  tr: {
    modalTitle: "AlwaysDraw — Özellikler ve Kullanım Kılavuzu",
    modalSubtitle: "Tek bir dünya. Tek bir tuval. Daima çizimde.",
    gotItBtn: "ANLADIM, ÇİZİME BAŞLA!",
    categories: {
      brushesTitle: "🎨 Fırçalar & Renk Sistemi",
      brushesDesc: "12 farklı fırça dokusu (Kurşun Kalem, Keçeli Kalem, Kaligrafi, Piksel, Sulu Boya, Yağlı Boya, Tebeşir, Kömür, Sim, Neon). Damlalık (I) ve Hex renk seçici.",
      textShapesTitle: "✍️ Vektör Metin & 8 Geometrik Şekil",
      textShapesDesc: "5 farklı yazı tipinde vektör metin yazın (X). 8 geometrik şekil çizin (Çizgi, Ok, Kare, Daire, Üçgen, Yıldız, Altıgen, Kalp).",
      creativeToolsTitle: "🪄 Boya Kovası & Çıkartmalar",
      creativeToolsDesc: "Kapalı alanları tek tıkla doldurun (F). Retro çıkartmalar yapıştırın, cetvelle ölçün (R), şablon (T) ve lazer (L) kullanın.",
      collabTitle: "👥 Canlı Çok Oyunculu Çizim & Yapışkan Notlar",
      collabDesc: "Çevrimiçi çizenlerle anlık çizim senkronizasyonu. Ülke bayraklı canlı imleçler. Duvara etkileşimli yapışkan notlar bırakın (C).",
      navTimeTitle: "🗺️ MiniHarita, Yoğunluk Haritası & Zaman Yolculuğu",
      navTimeDesc: "Odak noktalı kaydırma ve yakınlaştırma. Tıkla-ışınlan MiniHarita, çizim yoğunluk haritası (G), yer imleri ve çizgi çizgi Zaman Yolculuğu tekrarı.",
      shieldTitle: "🛡️ Duvar Koruma Kalkanı & Yönetici Paneli",
      shieldDesc: "Korumalı Alanlar (Mural Shield) sanat eserlerinin üzerine çizilmesini engeller. Yönetici paneli ile resim aktarma ve geri alma.",
    },
    shortcutsTitle: "Gezinme & Hızlı Kısayollar",
    panLabel: "Tuvali Kaydır",
    panDesc: "Space + Sürükle, El Aracı (H) veya 2 parmak sürükleme",
    zoomLabel: "Yakınlaştır / Uzaklaştır",
    zoomDesc: "Fare tekerleği, Dokunmatik çimdikleme veya Araç çubuğu +/-",
  },
  ja: {
    modalTitle: "AlwaysDraw — 機能＆使い方ガイド",
    modalSubtitle: "ひとつの世界。ひとつのキャンバス。常に描く。",
    gotItBtn: "了解、描き始めよう！",
    categories: {
      brushesTitle: "🎨 ブラシ＆カラーシステム",
      brushesDesc: "12種類のリアルな質感のブラシ（鉛筆、マーカー、カリグラフィー、ピクセル、水彩、油絵、チョーク、木炭、グリッター、ネオン）。スポイト（I）とHexカラー選択。",
      textShapesTitle: "✍️ ベクターテキスト＆8つの図形",
      textShapesDesc: "5つのフォントスタイルでベクターテキストを入力（X）。8つの図形（直線、矢印、四角、円、三角、星、六角形、ハート）を描画（S）。",
      creativeToolsTitle: "🪄 バケツ塗りつぶし・ステッカー",
      creativeToolsDesc: "ワンタップで領域を塗りつぶし（F）。レトロステッカー、定規（R）、ステンシル（T）、レーザー（L）。",
      collabTitle: "👥 リアルタイムマルチプレイヤー＆付箋メモ",
      collabDesc: "オンライン描画者とのリアルタイム同期。国旗付きリモートカーソル。キャンバス上にインタラクティブな付箋メモ（C）を残せます。",
      navTimeTitle: "🗺️ ミニマップ・ヒートマップ・タイムトラベル",
      navTimeDesc: "カーソル中心のパン＆ズーム。ワープ対応ミニマップ、描画密度ヒートマップ（G）、ブックマーク共有、描画履歴のタイムトラベル再生。",
      shieldTitle: "🛡️ 壁画保護シールド＆管理者ツール",
      shieldDesc: "保護エリア（Mural Shield）で作品の上書きを防止。管理者パネルで画像スタンプやロールバックを実行。",
    },
    shortcutsTitle: "ナビゲーション＆ショートカット",
    panLabel: "キャンバス移動",
    panDesc: "Space + ドラッグ、手のひらツール（H）、または2本指ドラッグ",
    zoomLabel: "ズーム",
    zoomDesc: "マウスホイール、ピンチイン・アウト、または +/- ボタン",
  },
};

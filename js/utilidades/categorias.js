// Categorías predeterminadas (no editables)
const CATS_DEFAULT = {
  personal: { color: '#1a3c6e', label: '👤 Personal', locked: true },
  trabajo:  { color: '#5c2e00', label: '💼 Trabajo',  locked: true },
  salud:    { color: '#1a5c1a', label: '🌿 Salud',    locked: true },
  finanzas: { color: '#6e3800', label: '💰 Finanzas', locked: true },
  estudios: { color: '#4a1a7a', label: '📚 Estudios', locked: true },
  hogar:    { color: '#7a1a4a', label: '🏠 Hogar',    locked: true },
  otro:     { color: '#3a2c08', label: '📌 Otro',     locked: true },
};

// Paleta de colores disponibles para categorías personalizadas
const CAT_PALETTE = [
  { hex: '#1a3c6e', name: 'Azul noche'    },
  { hex: '#1a5c1a', name: 'Verde bosque'  },
  { hex: '#5c2e00', name: 'Marrón cacao'  },
  { hex: '#6e3800', name: 'Naranja tostado'},
  { hex: '#4a1a7a', name: 'Violeta'       },
  { hex: '#7a1a4a', name: 'Vino tinto'    },
  { hex: '#3a2c08', name: 'Oliva oscuro'  },
  { hex: '#8b1a1a', name: 'Rojo carmesí'  },
  { hex: '#0e4d4d', name: 'Verde azulado' },
  { hex: '#2e4a1a', name: 'Verde oliva'   },
  { hex: '#1a4a3c', name: 'Verde esmeralda'},
  { hex: '#3c1a5c', name: 'Morado oscuro' },
  { hex: '#5c1a1a', name: 'Rojo ladrillo' },
  { hex: '#1a3a5c', name: 'Azul acero'    },
  { hex: '#4a3800', name: 'Ámbar oscuro'  },
  { hex: '#1f3d1f', name: 'Pino'          },
  { hex: '#5c3d00', name: 'Bronce'        },
  { hex: '#3d0e3d', name: 'Ciruela'       },
  { hex: '#0e3d5c', name: 'Zafiro'        },
  { hex: '#3d2e00', name: 'Cuero oscuro'  },
];

// Mapa activo: predeterminadas + personalizadas cargadas de IndexedDB
let CATS = { ...CATS_DEFAULT };

// Carga las categorías personalizadas desde IndexedDB al mapa CATS.
// Debe llamarse después de dbInit().
async function loadCustomCats() {
  const stored = await dbGetAllCats();
  for (const c of stored) {
    CATS[c.key] = { color: c.color, label: c.icon + ' ' + c.name, custom: true };
  }
}

async function saveCustomCat(cat) {
  await dbPutCat(cat);
}

async function deleteCustomCatDB(key) {
  await dbDeleteCat(key);
}

async function getCustomCats() {
  return await dbGetAllCats();
}


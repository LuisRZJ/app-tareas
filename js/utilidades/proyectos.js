// Capa de datos de proyectos (análogo a categorias.js)
let PROJECTS = [];

async function loadProjects() {
  PROJECTS = await dbGetAllProjects();
  PROJECTS.sort((a, b) => b.id - a.id);
}

async function saveProject(proj) {
  await dbPutProject(proj);
  const idx = PROJECTS.findIndex(p => p.id === proj.id);
  if (idx >= 0) PROJECTS[idx] = proj;
  else PROJECTS.unshift(proj);
}

async function deleteProjectDB(id) {
  await dbDeleteProject(id);
  PROJECTS = PROJECTS.filter(p => p.id !== id);
}

function getProjectById(id) {
  return PROJECTS.find(p => p.id === id) || null;
}

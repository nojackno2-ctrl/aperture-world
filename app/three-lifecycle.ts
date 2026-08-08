import type { Material, Mesh, Object3D, Texture, WebGLRenderer } from "three";

/**
 * Releases every unique GPU resource owned by one scene graph.
 *
 * Batching deliberately shares retained materials, so disposal must deduplicate
 * resources instead of disposing once per mesh.
 */
export function disposeObjectTree(root: Object3D, renderer: WebGLRenderer) {
  const geometries = new Set<NonNullable<Partial<Mesh>["geometry"]>>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();

  root.traverse(object => {
    const mesh = object as Partial<Mesh>;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const material = mesh.material;
    for (const item of Array.isArray(material) ? material : material ? [material] : []) {
      for (const value of Object.values(item)) {
        if (value && typeof value === "object" && "isTexture" in value && value.isTexture) textures.add(value as Texture);
      }
      materials.add(item);
    }
  });

  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
  root.clear();
  renderer.renderLists.dispose();
}

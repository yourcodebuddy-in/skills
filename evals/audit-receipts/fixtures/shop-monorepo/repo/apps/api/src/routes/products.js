import { NotFoundError, parseId, parsePage } from "../../../../packages/core/src/index.js";
import { publicProduct } from "../serialize.js";

const PAGE_SIZE = 24;

export const productRoutes = (router, { store }) => {
  router.get("/api/products", ({ query }) => {
    const page = parsePage(query.get("page"));
    const search = query.get("q")?.trim().slice(0, 100) || null;
    const { items, total } = store.products.list({
      search,
      sort: query.get("sort"),
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    return { body: { items: items.map(publicProduct), total, page, pageSize: PAGE_SIZE } };
  });

  router.get("/api/products/:id", ({ params }) => {
    const product = store.products.find(parseId(params.id));
    if (!product || !product.active) {
      throw new NotFoundError("product");
    }
    return { body: { product: publicProduct(product) } };
  });
};

package com.barbuddy.catalog;

import com.barbuddy.cocktails.Cocktail;
import com.barbuddy.cocktails.Recipe;
import com.barbuddy.cocktails.RecipeIngredient;
import com.barbuddy.ingredients.Ingredient;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Repository;

@Repository
public class CatalogBrowseRepository {
  private final EntityManager em;

  CatalogBrowseRepository(EntityManager em) {
    this.em = em;
  }

  public List<Object[]> missingIngredients(List<UUID> cocktails, String subject) {
    return em.createQuery(
            "select distinct l.recipe.cocktail.id, i.id, i.name, i.category from RecipeIngredient l join l.ingredient i where l.recipe.cocktail.id in :cocktails and l.requirement = 'required' and not exists (select b.id from InventoryItem b where b.ingredient = i and b.owner.authSubject = :subject and b.status = com.barbuddy.inventory.InventoryStatus.Have) order by i.name, i.id",
            Object[].class)
        .setParameter("cocktails", cocktails)
        .setParameter("subject", subject)
        .getResultList();
  }

  public Ingredient ingredient(UUID id) {
    return em.find(Ingredient.class, id);
  }

  public List<Ingredient> ingredients(String search, String category) {
    return em.createNativeQuery(
            "select i.* from ingredient i where (position(:search in catalog_search_key(i.name)) > 0 or exists (select 1 from unnest(i.aliases) a where position(:search in catalog_search_key(a)) > 0)) and (cast(:category as text) is null or i.category = :category) order by lower(i.name), i.id",
            Ingredient.class)
        .setParameter("search", search)
        .setParameter("category", category)
        .getResultList();
  }

  public List<Cocktail> cocktails(
      String search, UUID spirit, boolean favoritesOnly, String subject) {
    return em.createQuery(
            "select c from Cocktail c left join fetch c.primarySpirit where locate(:search, function('catalog_search_key', c.name)) > 0 and (:spirit is null or c.primarySpirit.id = :spirit) and (:favoritesOnly = false or exists (select s.id from UserCocktailState s where s.cocktail = c and s.owner.authSubject = :subject and s.favorite = true)) order by lower(c.name), c.id",
            Cocktail.class)
        .setParameter("search", search)
        .setParameter("spirit", spirit)
        .setParameter("favoritesOnly", favoritesOnly)
        .setParameter("subject", subject)
        .getResultList();
  }

  public Cocktail cocktail(UUID id) {
    return em.createQuery(
            "select c from Cocktail c left join fetch c.primarySpirit where c.id = :id",
            Cocktail.class)
        .setParameter("id", id)
        .getResultStream()
        .findFirst()
        .orElse(null);
  }

  public List<Cocktail> related(UUID ingredient) {
    return em.createQuery(
            "select c from Cocktail c left join fetch c.primarySpirit where exists (select l.id from RecipeIngredient l where l.recipe.cocktail = c and l.ingredient.id = :ingredient) order by lower(c.name), c.id",
            Cocktail.class)
        .setParameter("ingredient", ingredient)
        .getResultList();
  }

  public Recipe recipe(UUID cocktail) {
    return em.createQuery("select r from Recipe r where r.cocktail.id = :cocktail", Recipe.class)
        .setParameter("cocktail", cocktail)
        .getSingleResult();
  }

  public List<RecipeIngredient> lines(UUID recipe) {
    return em.createQuery(
            "select l from RecipeIngredient l join fetch l.ingredient where l.recipe.id = :recipe order by l.position",
            RecipeIngredient.class)
        .setParameter("recipe", recipe)
        .getResultList();
  }
}

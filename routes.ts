import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // === Restaurants ===
  app.get(api.restaurants.list.path, async (req, res) => {
    const restaurants = await storage.getRestaurants();
    res.json(restaurants);
  });

  app.get(api.restaurants.get.path, async (req, res) => {
    const restaurant = await storage.getRestaurant(Number(req.params.id));
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    res.json(restaurant);
  });

  app.post(api.restaurants.create.path, async (req, res) => {
    try {
      const input = api.restaurants.create.input.parse(req.body);
      const restaurant = await storage.createRestaurant(input);
      res.status(201).json(restaurant);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // === Menu Items ===
  app.get(api.menuItems.list.path, async (req, res) => {
    const items = await storage.getMenuItems(Number(req.params.restaurantId));
    res.json(items);
  });

  app.post(api.menuItems.create.path, async (req, res) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      const input = api.menuItems.create.input.parse(req.body);
      const item = await storage.createMenuItem({ ...input, restaurantId });
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // === Orders ===
  app.get(api.orders.list.path, async (req, res) => {
    const orders = await storage.getOrders();
    res.json(orders);
  });

  app.post(api.orders.create.path, async (req, res) => {
    try {
      const { items, ...orderData } = api.orders.create.input.parse(req.body);
      
      // Calculate total amount from items
      let totalAmount = 0;
      const orderItemsData = [];
      
      for (const item of items) {
        const menuItem = await storage.getMenuItem(item.menuItemId);
        if (menuItem) {
          const price = Number(menuItem.price);
          totalAmount += price * item.quantity;
          orderItemsData.push({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            price: price.toString(), // Store snapshot price
            orderId: 0, // Placeholder, updated in storage
          });
        }
      }

      const order = await storage.createOrder({
        ...orderData,
        userId: 1, // Default user for now, or from auth
        totalAmount: totalAmount.toString(),
        status: "pending",
      }, orderItemsData);

      res.status(201).json(order);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch(api.orders.updateStatus.path, async (req, res) => {
    const { status } = api.orders.updateStatus.input.parse(req.body);
    const order = await storage.updateOrderStatus(Number(req.params.id), status);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json(order);
  });

  // === Chat / WhatsApp Webhook Stub ===
  app.post(api.chat.webhook.path, async (req, res) => {
    // This is where you'd handle real WhatsApp incoming messages
    // For now, we just log it
    console.log("WhatsApp Webhook:", JSON.stringify(req.body, null, 2));
    
    // Simulate saving a chat log
    await storage.createChatLog({
      phoneNumber: "unknown",
      message: "Incoming message (webhook)",
      direction: "incoming"
    });

    res.json({ status: "received" });
  });

  app.get(api.chat.logs.path, async (req, res) => {
    const logs = await storage.getChatLogs();
    res.json(logs);
  });

  // === Seed Data ===
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const restaurants = await storage.getRestaurants();
  if (restaurants.length === 0) {
    const kitchen = await storage.createRestaurant({
      name: "Nepalgunj Cloud Kitchen",
      type: "cloud_kitchen",
      address: "B.P. Chowk, Nepalgunj",
      phoneNumber: "9800000000",
      image: "https://images.unsplash.com/photo-1556910103-1c02745a30bf?w=800&q=80",
    });

    await storage.createMenuItem({
      restaurantId: kitchen.id,
      name: "Chicken Momo",
      description: "Steamed chicken dumplings with spicy chutney",
      price: "150.00",
      category: "Momo",
      imageUrl: "https://images.unsplash.com/photo-1626074353765-517a681e40be?w=800&q=80",
      isAvailable: true,
    });

    await storage.createMenuItem({
      restaurantId: kitchen.id,
      name: "Chicken Chowmein",
      description: "Stir-fried noodles with chicken and veggies",
      price: "120.00",
      category: "Noodles",
      imageUrl: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&q=80",
      isAvailable: true,
    });
    
    await storage.createMenuItem({
      restaurantId: kitchen.id,
      name: "Burger & Fries",
      description: "Classic chicken burger with crispy fries",
      price: "250.00",
      category: "Fast Food",
      imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80",
      isAvailable: true,
    });

    // Create a demo user
    await storage.createUser({
      username: "demo_admin",
      password: "password123", // In real app, hash this!
      role: "admin",
      phoneNumber: "9800000001"
    });
  }
}

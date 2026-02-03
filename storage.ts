import { db } from "./db";
import {
  users, restaurants, menuItems, orders, orderItems, chatLogs,
  type User, type InsertUser,
  type Restaurant, type InsertRestaurant,
  type MenuItem, type InsertMenuItem,
  type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem,
  type ChatLog, type InsertChatLog
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Restaurants
  getRestaurants(): Promise<Restaurant[]>;
  getRestaurant(id: number): Promise<Restaurant | undefined>;
  createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant>;

  // Menu Items
  getMenuItems(restaurantId: number): Promise<MenuItem[]>;
  getMenuItem(id: number): Promise<MenuItem | undefined>;
  createMenuItem(item: InsertMenuItem): Promise<MenuItem>;

  // Orders
  getOrders(): Promise<(Order & { items: (OrderItem & { menuItem: MenuItem })[] })[]>;
  getOrder(id: number): Promise<(Order & { items: (OrderItem & { menuItem: MenuItem })[] }) | undefined>;
  createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  updateOrderStatus(id: number, status: string): Promise<Order | undefined>;

  // Chat
  createChatLog(log: InsertChatLog): Promise<ChatLog>;
  getChatLogs(): Promise<ChatLog[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getRestaurants(): Promise<Restaurant[]> {
    return await db.select().from(restaurants);
  }

  async getRestaurant(id: number): Promise<Restaurant | undefined> {
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, id));
    return restaurant;
  }

  async createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant> {
    const [res] = await db.insert(restaurants).values(restaurant).returning();
    return res;
  }

  async getMenuItems(restaurantId: number): Promise<MenuItem[]> {
    return await db.select().from(menuItems).where(eq(menuItems.restaurantId, restaurantId));
  }

  async getMenuItem(id: number): Promise<MenuItem | undefined> {
    const [item] = await db.select().from(menuItems).where(eq(menuItems.id, id));
    return item;
  }

  async createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
    const [newItem] = await db.insert(menuItems).values(item).returning();
    return newItem;
  }

  async getOrders(): Promise<(Order & { items: (OrderItem & { menuItem: MenuItem })[] })[]> {
    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
    
    // Enrich with items
    const enrichedOrders = await Promise.all(allOrders.map(async (order) => {
      const items = await db.query.orderItems.findMany({
        where: eq(orderItems.orderId, order.id),
        with: {
          menuItem: true
        }
      });
      return { ...order, items };
    }));

    return enrichedOrders;
  }

  async getOrder(id: number): Promise<(Order & { items: (OrderItem & { menuItem: MenuItem })[] }) | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;

    const items = await db.query.orderItems.findMany({
      where: eq(orderItems.orderId, order.id),
      with: {
        menuItem: true
      }
    });

    return { ...order, items };
  }

  async createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    
    for (const item of items) {
      await db.insert(orderItems).values({
        ...item,
        orderId: newOrder.id,
      });
    }

    return newOrder;
  }

  async updateOrderStatus(id: number, status: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ status })
      .where(eq(orders.id, id))
      .returning();
    return updated;
  }

  async createChatLog(log: InsertChatLog): Promise<ChatLog> {
    const [newLog] = await db.insert(chatLogs).values(log).returning();
    return newLog;
  }

  async getChatLogs(): Promise<ChatLog[]> {
    return await db.select().from(chatLogs).orderBy(desc(chatLogs.createdAt));
  }
}

export const storage = new DatabaseStorage();

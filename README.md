ML Operational App
IS 455: Machine Learning in Python — Chapter 17.9
This repository contains a complete web application built to demonstrate a realistic ML deployment pipeline. The app serves as the operational layer that interacts with an ML-enhanced SQLite database, bridge the gap between predictive modeling and business workflows.

🎯 Project Goal
The goal of this project was to build a functional web app on top of a live operational database (shop.db) that integrates with an ML inference job. It demonstrates the complete end-to-end pattern: Operational Data → Analytics Pipeline → Trained Model File → Automated Scoring → Operational Workflow Improvement.

🏗️ Technical Stack
Framework: Next.js (App Router)

Database: SQLite (shop.db)

DB Connector: better-sqlite3

Inference Engine: Python script (jobs/run_inference.py)

✨ Functional Requirements
As specified in the Chapter 17.9 requirements, this application implements the following features:

Select Customer (No-Auth): Users select an existing customer from the database to "act as" during testing. Selection is stored in a cookie.

Customer Dashboard: Displays summary statistics (total spend, order count) and the 5 most recent orders for the selected user.

Place Order: Allows users to select products and quantities, inserting records into orders and order_items using database transactions.

Order History: View comprehensive past orders and drill down into specific line-item details.

Warehouse Priority Queue: Displays the "Late Delivery Priority Queue" (top 50 unfulfilled orders) ranked by the ML-generated late_delivery_probability.

ML Scoring Trigger: A dedicated page with a button to execute the Python inference script, which writes predictions into the order_predictions table.

📊 Database Contract
The application interacts strictly with the following schema provided in the course instructions:

customers: Contains customer_id, first_name, last_name, and email.

orders: Contains order_id, order_timestamp, fulfilled, and total_value.

order_items: Stores the line items for each order.

products: Contains the product catalog and pricing.

order_predictions: The ML output table containing late_delivery_probability and predicted_late_delivery.

🚀 Setup and Installation
Ensure shop.db is located at the project root.

Install JavaScript dependencies:

Bash
npm install
Run the application:

Bash
npm run dev
✅ Manual QA Checklist
To verify the application matches expected behavior, the following steps must be completed:

Select Customer: Choose a customer and verify the ID is stored and visible in the app banner.

Place Order: Create a new order and verify it appears in the Customer's Order History.

Run Scoring: Trigger the inference job and ensure it successfully writes new scores to the database.

Priority Queue: Confirm the new order appears in the warehouse queue, correctly ranked by its delivery probability.

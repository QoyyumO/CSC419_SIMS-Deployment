# SIMS

## Overview
Student/School Information Manàgement System


## Technologies

- React
- Next
- Convex
- Postgres

## Installation

### Prerequisites

To get started with SIMS, ensure you have the following prerequisites installed and set up:

- [Node.js 24.x.x](https://nodejs.org/en/about/previous-releases) or later
- A Convex account (sign up at [convex.dev](https://convex.dev) if you don't have one)

### Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   ```

2. **Navigate to the project directory**
   ```bash
   cd sims
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Set up environment variables**
   
   If there's a `.env.example` file, copy it to `.env.local`:
   ```bash
   cp ./.env.example ./.env.local
   ```
   
   Otherwise, create a `.env.local` file in the `sims` directory.

5. **Set up Convex backend**
   
   Run the Convex development server (this will prompt you to log in if you haven't already):
   ```bash
   npx convex dev
   ```
   
   This command will:
   - Set up your Convex project (if not already set up)
   - Start the Convex development server
   - Automatically set the `NEXT_PUBLIC_CONVEX_URL` environment variable in your `.env.local` file
   
   Keep this terminal window running.

## Running the Application

### Development Mode

1. **Start the Convex backend** (in one terminal):
   ```bash
   npx convex dev
   ```

2. **Start the Next.js frontend** (in another terminal):
   ```bash
   npm run dev
   ```

3. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000) to view the application.

### Production Mode

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start the production server**
   ```bash
   npm start
   ```

### Other Available Commands

- **Lint code**: `npm run lint`
- **Type check**: `npm run type-check`
- **Run both lint and type check**: `npm run check`
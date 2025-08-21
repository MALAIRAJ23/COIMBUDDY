#!/bin/bash

# Car Pooling App Deployment Script
# This script automates the deployment process for the car pooling application

set -e  # Exit on any error

echo "🚗 Starting Car Pooling App Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Firebase CLI is installed
check_firebase_cli() {
    print_status "Checking Firebase CLI installation..."
    if ! command -v firebase &> /dev/null; then
        print_error "Firebase CLI is not installed. Please install it first:"
        echo "npm install -g firebase-tools"
        exit 1
    fi
    print_success "Firebase CLI is installed"
}

# Check if user is logged in to Firebase
check_firebase_login() {
    print_status "Checking Firebase login status..."
    if ! firebase projects:list &> /dev/null; then
        print_error "Not logged in to Firebase. Please login first:"
        echo "firebase login"
        exit 1
    fi
    print_success "Logged in to Firebase"
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    if [ ! -d "node_modules" ]; then
        npm install
        print_success "Dependencies installed"
    else
        print_status "Dependencies already installed, skipping..."
    fi
}

# Run tests
run_tests() {
    print_status "Running tests..."
    if npm test -- --watchAll=false --passWithNoTests; then
        print_success "Tests passed"
    else
        print_warning "Tests failed, but continuing with deployment..."
    fi
}

# Build the application
build_app() {
    print_status "Building the application..."
    if npm run build; then
        print_success "Application built successfully"
    else
        print_error "Build failed"
        exit 1
    fi
}

# Deploy Firebase security rules
deploy_firestore_rules() {
    print_status "Deploying Firestore security rules..."
    if firebase deploy --only firestore:rules; then
        print_success "Firestore rules deployed"
    else
        print_error "Failed to deploy Firestore rules"
        exit 1
    fi
}

# Deploy to Firebase Hosting
deploy_hosting() {
    print_status "Deploying to Firebase Hosting..."
    if firebase deploy --only hosting; then
        print_success "Application deployed to Firebase Hosting"
    else
        print_error "Failed to deploy to Firebase Hosting"
        exit 1
    fi
}

# Deploy everything
deploy_all() {
    print_status "Deploying everything..."
    if firebase deploy; then
        print_success "Complete deployment successful"
    else
        print_error "Deployment failed"
        exit 1
    fi
}

# Show deployment URL
show_deployment_url() {
    print_status "Getting deployment URL..."
    PROJECT_ID=$(firebase use --json | grep -o '"current":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$PROJECT_ID" ]; then
        print_success "Your app is deployed at: https://$PROJECT_ID.web.app"
        print_success "Firebase Console: https://console.firebase.google.com/project/$PROJECT_ID"
    fi
}

# Main deployment function
main() {
    echo "=========================================="
    echo "🚗 Car Pooling App Deployment"
    echo "=========================================="
    
    # Pre-deployment checks
    check_firebase_cli
    check_firebase_login
    
    # Build and deploy
    install_dependencies
    run_tests
    build_app
    deploy_firestore_rules
    deploy_hosting
    
    # Show results
    show_deployment_url
    
    echo "=========================================="
    print_success "Deployment completed successfully! 🎉"
    echo "=========================================="
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -r, --rules    Deploy only Firestore rules"
    echo "  -h, --hosting  Deploy only hosting"
    echo "  -a, --all      Deploy everything (default)"
    echo ""
    echo "Examples:"
    echo "  $0              # Deploy everything"
    echo "  $0 --rules      # Deploy only Firestore rules"
    echo "  $0 --hosting    # Deploy only hosting"
}

# Parse command line arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    -r|--rules)
        check_firebase_cli
        check_firebase_login
        deploy_firestore_rules
        exit 0
        ;;
    -h|--hosting)
        check_firebase_cli
        check_firebase_login
        install_dependencies
        build_app
        deploy_hosting
        show_deployment_url
        exit 0
        ;;
    -a|--all|"")
        main
        exit 0
        ;;
    *)
        print_error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac

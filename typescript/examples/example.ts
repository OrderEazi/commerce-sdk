/**
 * Example usage of the OrderEazi Commerce Headless API TypeScript SDK.
 *
 * This lives outside src/ (not compiled/shipped with the package - see tsconfig.json's "include") since it's
 * reference material, not library code. Run it with ts-node after building the SDK once:
 *
 *   cd src/Tools/Storefront.Sdk/TypeScript
 *   npm install && npm run generate && npm run build
 *   npx ts-node examples/example.ts
 *
 * The generator produces a shared Configuration object plus one XxxApi class per resource (named from the
 * API's OpenAPI tags) - not a single unified client class. Exact class/method names are generated from the
 * spec, so they'll shift as Storefront.Api's "store" OpenAPI document evolves; this is representative of the
 * current shape.
 */
import { Configuration, AuthApi, CatalogApi, SearchApi, CartApi, CheckoutApi } from '../src/index';

async function example() {
	const config = new Configuration({
		basePath: 'http://localhost:5135',
		// Store Access Key (pk_store_.../sk_store_...) is required on every request; a JWT bearer token is
		// added once the customer logs in (see authedConfig below).
		baseOptions: { headers: { 'X-Commerce-Key': 'pk_store_...' } },
	});

	try {
		// 1. Register or log in
		const authApi = new AuthApi(config);
		const loginResponse = await authApi.authLoginApi({ email: 'user@example.com', password: 'SecurePassword123!' });

		const authedConfig = new Configuration({
			...config,
			accessToken: loginResponse.data.token,
		});

		// 2. Browse the catalog
		// Note: GetCategories currently returns an untyped body (anonymous { Categories: [...] } on the
		// server side) - most Store endpoints are fully typed, this one is a known gap.
		const catalogApi = new CatalogApi(config);
		const categories: any = await catalogApi.catalogGetCategoriesApi();
		console.log(`Found ${categories.data?.Categories?.length ?? 0} categories`);

		// 3. Search products
		const searchApi = new SearchApi(config);
		const results = await searchApi.searchGetProductsApi('laptop', 1, 20);
		console.log(`Found ${results.data.products?.length ?? 0} products`);

		// 4. Add to cart (guest carts work the same way - the server issues an X-Session-Ref header the
		// generated client's Axios instance will echo back automatically on subsequent requests)
		const cartApi = new CartApi(authedConfig);
		await cartApi.cartAddItemApi({ productId: 123, qty: 1 });
		const cart = await cartApi.cartGetCartApi();
		console.log(`Cart has ${cart.data.items?.length ?? 0} item(s)`);

		// 5. Checkout
		const checkoutApi = new CheckoutApi(authedConfig);
		const paymentOptions = await checkoutApi.checkoutGetPaymentOptionsApi();
		await checkoutApi.checkoutSetDeliveryAddressApi({
			address1: '123 Main St',
			city: 'Cape Town',
			postalCode: '8001',
			countryId: 1,
			firstName: 'John',
			lastName: 'Doe',
			phone: '555-1234',
			email: 'user@example.com',
		});
		await checkoutApi.checkoutSetPaymentOptionApi({ paymentSystemName: paymentOptions.data[0]?.systemName });

		const order = await checkoutApi.checkoutCreateOrderApi({ checksum: cart.data.checksum, paymentMethodName: paymentOptions.data[0]?.systemName });
		console.log('Order created! Reference:', order.data.orderRef);
	} catch (error: any) {
		console.error('Error:', error.message);
		if (error.response) {
			// Every failure follows the RFC 9457 Problem Details shape - see StoreProblemDetailsModel.
			console.error('Problem details:', error.response.data);
		}
	}
}

if (require.main === module) {
	example();
}

export { example };

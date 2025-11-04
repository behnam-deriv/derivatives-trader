import { getBrandHomeUrl } from '@deriv/shared';
import { mockStore, StoreProvider } from '@deriv/stores';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BrandShortLogo from '../brand-short-logo';

jest.mock('@deriv/shared', () => ({
    getBrandHomeUrl: jest.fn(() => 'https://home.deriv.com/dashboard/home'),
}));

jest.mock('App/Hooks/useMobileBridge', () => ({
    useMobileBridge: jest.fn(() => ({
        sendBridgeEvent: jest.fn(),
        isBridgeAvailable: jest.fn(() => false),
        isDesktop: true,
    })),
}));

// Mock window.location.href
const mockLocation = {
    href: '',
};
Object.defineProperty(window, 'location', {
    value: mockLocation,
    writable: true,
});

describe('BrandShortLogo', () => {
    const mock_store = mockStore({
        common: {
            current_language: 'EN',
        },
    });

    const renderComponent = () =>
        render(
            <StoreProvider store={mock_store}>
                <BrandShortLogo />
            </StoreProvider>
        );

    beforeEach(() => {
        jest.clearAllMocks();
        mockLocation.href = '';
        // Reset getBrandHomeUrl mock to default value
        (getBrandHomeUrl as jest.Mock).mockReturnValue('https://home.deriv.com/dashboard/home');
        // Clear DerivAppChannel from window
        delete (window as any).DerivAppChannel;
    });

    it('should render the Deriv logo', () => {
        renderComponent();

        const logoContainer = screen.getByRole('img');
        expect(logoContainer).toBeInTheDocument();

        const clickableDiv = screen.getByTestId('brand-logo-clickable');
        expect(clickableDiv).toHaveStyle('cursor: pointer');
    });

    it('should redirect to brand URL with language parameter when logo is clicked', async () => {
        // Mock desktop behavior - should execute fallback
        const { useMobileBridge } = require('App/Hooks/useMobileBridge');
        const mockSendBridgeEvent = jest.fn((event, fallback) => {
            fallback(); // Execute fallback for desktop
        });
        useMobileBridge.mockReturnValue({
            sendBridgeEvent: mockSendBridgeEvent,
            isBridgeAvailable: jest.fn(() => false),
            isDesktop: true,
        });

        renderComponent();

        const clickableDiv = screen.getByTestId('brand-logo-clickable');

        await userEvent.click(clickableDiv);

        expect(mockSendBridgeEvent).toHaveBeenCalledWith('trading:home', expect.any(Function));
        expect(getBrandHomeUrl).toHaveBeenCalledWith('EN');
        expect(mockLocation.href).toBe('https://home.deriv.com/dashboard/home');
    });

    it('should handle different brand URLs correctly', async () => {
        (getBrandHomeUrl as jest.Mock).mockReturnValue('https://staging-home.deriv.com/dashboard/home');

        // Mock desktop behavior - should execute fallback
        const { useMobileBridge } = require('App/Hooks/useMobileBridge');
        const mockSendBridgeEvent = jest.fn((event, fallback) => {
            fallback(); // Execute fallback for desktop
        });
        useMobileBridge.mockReturnValue({
            sendBridgeEvent: mockSendBridgeEvent,
            isBridgeAvailable: jest.fn(() => false),
            isDesktop: true,
        });

        renderComponent();

        const clickableDiv = screen.getByTestId('brand-logo-clickable');

        await userEvent.click(clickableDiv);

        expect(mockSendBridgeEvent).toHaveBeenCalledWith('trading:home', expect.any(Function));
        expect(mockLocation.href).toBe('https://staging-home.deriv.com/dashboard/home');
    });

    it('should use Flutter channel postMessage on mobile when bridge is available', async () => {
        // Mock mobile bridge available
        const { useMobileBridge } = require('App/Hooks/useMobileBridge');
        const mockSendBridgeEvent = jest.fn();
        useMobileBridge.mockReturnValue({
            sendBridgeEvent: mockSendBridgeEvent,
            isBridgeAvailable: jest.fn(() => true),
            isDesktop: false,
        });

        renderComponent();

        const clickableDiv = screen.getByTestId('brand-logo-clickable');

        await userEvent.click(clickableDiv);

        expect(mockSendBridgeEvent).toHaveBeenCalledWith('trading:home', expect.any(Function));
    });

    it('should fallback to brand URL when bridge is not available', async () => {
        // Reset the mock to return the default URL
        (getBrandHomeUrl as jest.Mock).mockReturnValue('https://home.deriv.com/dashboard/home');
        
        // Mock bridge not available
        const { useMobileBridge } = require('App/Hooks/useMobileBridge');
        const mockSendBridgeEvent = jest.fn((event, fallback) => {
            fallback(); // Execute fallback
        });
        useMobileBridge.mockReturnValue({
            sendBridgeEvent: mockSendBridgeEvent,
            isBridgeAvailable: jest.fn(() => false),
            isDesktop: false,
        });

        renderComponent();

        const clickableDiv = screen.getByTestId('brand-logo-clickable');

        await userEvent.click(clickableDiv);

        expect(mockSendBridgeEvent).toHaveBeenCalledWith('trading:home', expect.any(Function));
        expect(getBrandHomeUrl).toHaveBeenCalled();
        expect(mockLocation.href).toBe('https://home.deriv.com/dashboard/home');
    });

    it('should handle bridge errors gracefully', async () => {
        // Mock bridge error
        const { useMobileBridge } = require('App/Hooks/useMobileBridge');
        const mockSendBridgeEvent = jest.fn((event, fallback) => {
            fallback(); // Execute fallback on error
        });
        useMobileBridge.mockReturnValue({
            sendBridgeEvent: mockSendBridgeEvent,
            isBridgeAvailable: jest.fn(() => true),
            isDesktop: false,
        });

        renderComponent();

        const clickableDiv = screen.getByTestId('brand-logo-clickable');

        await userEvent.click(clickableDiv);

        expect(mockSendBridgeEvent).toHaveBeenCalledWith('trading:home', expect.any(Function));
        expect(getBrandHomeUrl).toHaveBeenCalled();
        expect(mockLocation.href).toBe('https://home.deriv.com/dashboard/home');
    });
});

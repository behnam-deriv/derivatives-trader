import React from 'react';

import { getBrandHomeUrl } from '@deriv/shared';
import { observer, useStore } from '@deriv/stores';

import { BrandDerivLogoCoralIcon } from '@deriv/quill-icons';
import { useMobileBridge } from 'App/Hooks/useMobileBridge';

const BrandShortLogo = observer(() => {
    const { common } = useStore();
    const { current_language } = common;
    const { sendBridgeEvent } = useMobileBridge();

    const handleLogoClick = () => {
        sendBridgeEvent('trading:home', () => {
            const brandUrl = getBrandHomeUrl(current_language);
            window.location.href = brandUrl;
        });
    };

    return (
        <div className='header__menu-left-logo'>
            <div onClick={handleLogoClick} style={{ cursor: 'pointer' }} data-testid='brand-logo-clickable'>
                <BrandDerivLogoCoralIcon width={24} height={24} />
            </div>
        </div>
    );
});

export default BrandShortLogo;

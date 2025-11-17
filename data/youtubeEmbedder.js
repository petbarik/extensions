(function(Scratch) {
    'use strict';

    // Keep global reference to popup
    let popupWindow = null;

    class YTPopupOnly {
        getInfo() {
            return {
                id: 'ytpopuponly',
                name: 'YouTube Popup',
                color1: '#FF0000',
                color2: '#CC0000',
                blocks: [
                    {
                        opcode: 'playVideoPopup',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'play YouTube video [URL]',
                        arguments: {
                            URL: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
                            }
                        }
                    },
                    {
                        opcode: 'closeVideoPopup',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'close video popup'
                    },
                    {
                        opcode: 'isPopupOpen',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text: 'popup is open?'
                    }
                ]
            };
        }

        // Play video in popup
        playVideoPopup(args) {
            const url = args.URL;
            const videoId = this.extractId(url);
            if (!videoId) {
                alert('Invalid YouTube URL');
                return;
            }

            // Close previous popup if open
            if (popupWindow && !popupWindow.closed) {
                popupWindow.close();
            }

            popupWindow = window.open(
                'https://www.youtube.com/embed/' + videoId + '?autoplay=1',
                '_blank',
                'width=960,height=540'
            );

            if (!popupWindow) {
                alert('Popup blocked! Allow popups for this site.');
            }
        }

        // Close popup
        closeVideoPopup() {
            if (popupWindow && !popupWindow.closed) {
                popupWindow.close();
            }
            popupWindow = null;
        }

        // Boolean: check if popup is open
        isPopupOpen() {
            return !!(popupWindow && !popupWindow.closed);
        }

        // Extract video ID from YouTube URL
        extractId(url) {
            try {
                const u = new URL(url);
                if (u.hostname.includes('youtu.be')) {
                    return u.pathname.slice(1);
                }
                return u.searchParams.get('v');
            } catch(e) {
                return null;
            }
        }
    }

    Scratch.extensions.register(new YTPopupOnly());

})(Scratch);

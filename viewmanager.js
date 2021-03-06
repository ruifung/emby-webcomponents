define(['viewcontainer', 'focusManager', 'queryString', 'connectionManager', 'events'], function (viewcontainer, focusManager, queryString, connectionManager, events) {

    var currentView;
    var dispatchPageEvents;

    viewcontainer.setOnBeforeChange(function (newView, isRestored, options) {

        var lastView = currentView;
        if (lastView) {
            dispatchViewEvent(lastView, 'viewbeforehide');
        }

        if (!newView.initComplete) {
            newView.initComplete = true;

            var eventDetail = getViewEventDetail(newView, options, false);

            if (options.controllerFactory) {

                // Use controller method
                var controller = new options.controllerFactory(newView, eventDetail.detail.params);
            }

            if (!options.controllerFactory || dispatchPageEvents) {
                dispatchViewEvent(newView, 'viewinit');
            }
        }

        dispatchViewEvent(newView, 'viewbeforeshow', isRestored);
    });

    function onViewChange(view, options, isRestore) {

        var viewType = options.type;

        var lastView = currentView;
        if (lastView) {
            dispatchViewEvent(lastView, 'viewhide');
        }

        currentView = view;

        var eventDetail = getViewEventDetail(view, options, isRestore);

        if (!isRestore) {
            if (options.autoFocus !== false) {
                focusManager.autoFocus(view);
            }
        }
        else if (view.activeElement) {
            view.activeElement.focus();
        }

        view.dispatchEvent(new CustomEvent('viewshow', eventDetail));

        if (dispatchPageEvents) {
            view.dispatchEvent(new CustomEvent('pageshow', eventDetail));
        }
    }

    function dispatchViewEvent(view, eventName, isRestored) {

        view.dispatchEvent(new CustomEvent(eventName, {
            detail: {
                type: view.getAttribute('data-type'),
                isRestored: isRestored
            },
            bubbles: true,
            cancelable: false
        }));

        if (dispatchPageEvents) {
            view.dispatchEvent(new CustomEvent(eventName.replace('view', 'page'), {
                detail: {
                    type: view.getAttribute('data-type'),
                    isRestored: isRestored
                },
                bubbles: true,
                cancelable: false
            }));
        }
    }

    function getViewEventDetail(view, options, isRestore) {

        var url = options.url;
        var state = options.state;
        var index = url.indexOf('?');
        var params = index == -1 ? {} : queryString.parse(url.substring(index + 1));

        return {
            detail: {
                type: view.getAttribute('data-type'),
                params: params,
                isRestored: isRestore,
                state: options.state,

                // The route options
                options: options.options || {}
            },
            bubbles: true,
            cancelable: false
        };
    }

    function resetCachedViews() {
        // Reset all cached views whenever the skin changes
        viewcontainer.reset();
    }

    document.addEventListener('skinunload', resetCachedViews);

    events.on(connectionManager, 'localusersignedin', resetCachedViews);
    events.on(connectionManager, 'localusersignedout', resetCachedViews);

    function tryRestoreInternal(viewcontainer, options, resolve, reject) {

        if (options.cancel) {
            return;
        }

        viewcontainer.tryRestoreView(options).then(function (view) {

            onViewChange(view, options, true);
            resolve();

        }, reject);
    }

    function ViewManager() {

        var self = this;

        self.loadView = function (options) {

            var lastView = currentView;

            // Record the element that has focus
            if (lastView) {
                lastView.activeElement = document.activeElement;
            }

            if (options.cancel) {
                return;
            }

            viewcontainer.loadView(options).then(function (view) {

                onViewChange(view, options);
            });
        };

        self.tryRestoreView = function (options) {
            return new Promise(function (resolve, reject) {

                if (options.cancel) {
                    return;
                }

                // Record the element that has focus
                if (currentView) {
                    currentView.activeElement = document.activeElement;
                }

                tryRestoreInternal(viewcontainer, options, resolve, reject);
            });
        };

        self.dispatchPageEvents = function (value) {
            dispatchPageEvents = value;
        };
    }

    return new ViewManager();
});

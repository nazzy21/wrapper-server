import * as _ from "./utils";

export function Screen(screens, serverData, server) {
    for(const screen of screens) {
        if (_.isArray(screen)) {
            return Screen(screen, serverData, server);
        }

        if (_.isObject(screen) && !screen.routePath) {
            return Object.values(screen).map( sc => Screen([sc], serverData, server));
        }

        // Add navigation menu
        const {showInNavMenu, menu} = screen;

        if (showInNavMenu) {
            if (!serverData.menus[showInNavMenu]) {
                serverData[showInNavMenu] = [];
            }

            serverData[showInNavMenu].push(menu);
        }

        let routePath = _.isArray(screen.routePath) ? screen.routePath : [screen.routePath],
            locations = serverData.routes[server];

        routePath.map( route => {
            const _route = _.extend({server, route}, screen);

            // Remove routepath
            delete _route.routePath;

            locations.push(_route);
        });
    }
}
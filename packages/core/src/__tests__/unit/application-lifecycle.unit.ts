// Copyright IBM Corp. 2017,2018. All Rights Reserved.
// Node module: @loopback/core
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {
  bind,
  BindingScope,
  Constructor,
  Context,
  createBindingFromClass,
} from '@loopback/context';
import {expect} from '@loopback/testlab';
import {
  Application,
  Component,
  CoreBindings,
  CoreTags,
  LifeCycleObserver,
  Server,
} from '../..';
import {lifeCycleObserver} from '../../lifecycle';

describe('Application life cycle', () => {
  describe('start', () => {
    it('starts all injected servers', async () => {
      const app = new Application();
      app.component(FakeComponent);
      const component = await app.get<FakeComponent>(
        `${CoreBindings.COMPONENTS}.FakeComponent`,
      );
      expect(component.status).to.equal('not-initialized');
      await app.start();
      const server = await app.getServer(FakeServer);

      expect(server).to.not.be.null();
      expect(server.listening).to.equal(true);
      expect(component.status).to.equal('started');
      await app.stop();
    });

    it('starts servers bound with `LIFE_CYCLE_OBSERVER` tag', async () => {
      const app = new Application();
      app
        .bind('fake-server')
        .toClass(FakeServer)
        .tag(CoreTags.LIFE_CYCLE_OBSERVER, CoreTags.SERVER)
        .inScope(BindingScope.SINGLETON);
      await app.start();
      const server = await app.get<FakeServer>('fake-server');

      expect(server).to.not.be.null();
      expect(server.listening).to.equal(true);
      await app.stop();
    });

    it('starts/stops all registered components', async () => {
      const app = new Application();
      app.component(FakeComponent);
      const component = await app.get<FakeComponent>(
        `${CoreBindings.COMPONENTS}.FakeComponent`,
      );
      expect(component.status).to.equal('not-initialized');
      await app.start();
      expect(component.status).to.equal('started');
      await app.stop();
      expect(component.status).to.equal('stopped');
    });

    it('starts/stops all observers from the component', async () => {
      const app = new Application();
      app.component(FakeComponentWithObservers);
      const observer = await app.get<MyObserver>(
        'lifeCycleObservers.MyObserver',
      );
      const observerWithDecorator = await app.get<MyObserverWithDecorator>(
        'lifeCycleObservers.MyObserverWithDecorator',
      );
      expect(observer.status).to.equal('not-initialized');
      expect(observerWithDecorator.status).to.equal('not-initialized');
      await app.start();
      expect(observer.status).to.equal('started');
      expect(observerWithDecorator.status).to.equal('started');
      await app.stop();
      expect(observer.status).to.equal('stopped');
      expect(observerWithDecorator.status).to.equal('stopped');
    });

    it('starts/stops all registered life cycle observers', async () => {
      const app = new Application();
      app.lifeCycleObserver(MyObserver, 'my-observer');

      const observer = await app.get<MyObserver>(
        'lifeCycleObservers.my-observer',
      );
      expect(observer.status).to.equal('not-initialized');
      await app.start();
      expect(observer.status).to.equal('started');
      await app.stop();
      expect(observer.status).to.equal('stopped');
    });

    it('honors @bind', async () => {
      const app = new Application();
      const binding = createBindingFromClass(MyObserverWithBind);
      app.add(binding);
      expect(binding.tagMap[CoreTags.LIFE_CYCLE_OBSERVER_GROUP]).to.eql(
        'my-group',
      );

      const observer = await app.get<MyObserverWithBind>(binding.key);
      expect(observer.status).to.equal('not-initialized');
      await app.start();
      expect(observer.status).to.equal('started');
      await app.stop();
      expect(observer.status).to.equal('stopped');
    });

    it('honors @lifeCycleObserver', async () => {
      const app = new Application();
      const binding = createBindingFromClass(MyObserverWithDecorator);
      app.add(binding);
      expect(binding.tagMap[CoreTags.LIFE_CYCLE_OBSERVER_GROUP]).to.eql(
        'my-group',
      );

      const observer = await app.get<MyObserverWithDecorator>(binding.key);
      expect(observer.status).to.equal('not-initialized');
      await app.start();
      expect(observer.status).to.equal('started');
      await app.stop();
      expect(observer.status).to.equal('stopped');
    });

    it('does not attempt to start poorly named bindings', async () => {
      const app = new Application();
      let startInvoked = false;
      let stopInvoked = false;

      // The app.start should not attempt to start this binding.
      app.bind('controllers.servers').to({
        start: () => {
          startInvoked = true;
        },
        stop: () => {
          stopInvoked = true;
        },
      });
      await app.start();
      expect(startInvoked).to.be.false(); // not invoked
      await app.stop();
      expect(stopInvoked).to.be.false(); // not invoked
    });
  });
});

class FakeComponent implements Component {
  status = 'not-initialized';
  servers: {
    [name: string]: Constructor<Server>;
  };
  constructor() {
    this.servers = {
      FakeServer,
      FakeServer2: FakeServer,
    };
  }
  start() {
    this.status = 'started';
  }
  stop() {
    this.status = 'stopped';
  }
}

class FakeServer extends Context implements Server {
  listening: boolean = false;
  constructor() {
    super();
  }
  async start(): Promise<void> {
    this.listening = true;
  }

  async stop(): Promise<void> {
    this.listening = false;
  }
}

class MyObserver implements LifeCycleObserver {
  status = 'not-initialized';

  start() {
    this.status = 'started';
  }
  stop() {
    this.status = 'stopped';
  }
}

@bind({
  tags: {
    [CoreTags.LIFE_CYCLE_OBSERVER]: CoreTags.LIFE_CYCLE_OBSERVER,
    [CoreTags.LIFE_CYCLE_OBSERVER_GROUP]: 'my-group',
    namespace: CoreBindings.LIFE_CYCLE_OBSERVERS,
  },
  scope: BindingScope.SINGLETON,
})
class MyObserverWithBind implements LifeCycleObserver {
  status = 'not-initialized';

  start() {
    this.status = 'started';
  }
  stop() {
    this.status = 'stopped';
  }
}

@lifeCycleObserver('my-group', BindingScope.SINGLETON)
class MyObserverWithDecorator implements LifeCycleObserver {
  status = 'not-initialized';

  start() {
    this.status = 'started';
  }
  stop() {
    this.status = 'stopped';
  }
}

class FakeComponentWithObservers implements Component {
  lifeCycleObservers = [MyObserver, MyObserverWithDecorator];
}

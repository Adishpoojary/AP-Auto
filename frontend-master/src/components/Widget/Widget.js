/**
 * Flatlogic Dashboards (https://flatlogic.com/admin-dashboards)
 *
 * Copyright © 2015-present Flatlogic, LLC. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import React from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';

import s from './Widget.module.scss';

class Widget extends React.Component {
  static propTypes = {
    title: PropTypes.node,
    className: PropTypes.string,
    children: PropTypes.oneOfType([
      PropTypes.arrayOf(PropTypes.node),
      PropTypes.node,
    ]),
  };

  static defaultProps = {
    title: null,
    className: '',
    children: [],
  };

  render() {
    const { title, className, children, ...rest } = this.props;
    return (
      <section className={cx(s.widget, className)} {...rest}>
        {title &&
        (typeof title === 'string' ? (
          <h5 className={s.title}>{title}</h5>
        ) : (
          <header className={s.title}>{title}</header>
        ))}
        <div>{children}</div>
      </section>
    );
  }
}

export default Widget;

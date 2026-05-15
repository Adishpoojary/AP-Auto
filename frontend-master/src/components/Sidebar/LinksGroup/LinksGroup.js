import React, {Component} from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import { NavLink } from 'react-router-dom';
import { Collapse } from 'reactstrap';
import { Route } from 'react-router';

import Icon from '../../Icon/Icon';

import s from './LinksGroup.module.scss';

class LinksGroup extends Component {
  /* eslint-disable */
  static propTypes = {
    header: PropTypes.node.isRequired,
    headerLink: PropTypes.string,
    childrenLinks: PropTypes.array,
    glyph: PropTypes.string,
    className: PropTypes.string,
    badge: PropTypes.number,
    opsMap: PropTypes.bool,
  };
  /* eslint-enable */

  static defaultProps = {
    headerLink: null,
    childrenLinks: null,
    className: '',
    glyph: null,
    badge: null,
    opsMap: false,
  };

  constructor(props) {
    super(props);

    this.state = {
      isOpen: false,
    };
  }

  render() {
    const { className, childrenLinks, headerLink, header, glyph, badge, opsMap } = this.props;
    const { isOpen } = this.state;
    if (!childrenLinks) {
      return (
        <li className={cx(s.headerLink, { [s.opsMap]: opsMap }, className)}>
          <NavLink
            to={headerLink}
            activeClassName={s.headerLinkActive}
            exact
          >
            <div>
              {glyph && <Icon glyph={glyph} />}
              <span>{header}</span>
              {badge > 0 && (
                <span className={s.badge} style={{ 
                  backgroundColor: '#dc3545', 
                  color: 'white', 
                  borderRadius: '50%', 
                  padding: '3px', 
                  fontSize: '10px',
                  marginLeft: '6px',
                  fontWeight: '600',
                  minWidth: '18px',
                  height: '18px',
                  textAlign: 'center',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: '1'
                }}>
                  {badge}
                </span>
              )}
            </div>
          </NavLink>
        </li>
      );
    }
    /* eslint-disable */
    return (
      <Route
        path={headerLink}
        children={({match}) => {
          return (
            <li className={cx(s.headerLink, { [s.opsMap]: opsMap }, className)}>
              <a
                className={cx({[s.headerLinkActive]: !!match && match.url.indexOf(headerLink) !== -1 })}
                onClick={() => this.setState({isOpen: !isOpen})}
              >
                <div>
                  {glyph && <Icon glyph={glyph} />}
                  <span>{header}</span>
                </div>
                <b className={cx('fa fa-angle-left arrow', s.arrow, {[s.arrowActive]: isOpen})} />
              </a>
              {/* eslint-enable */}
              <Collapse className={s.panel} isOpen={isOpen}>
                <ul>
                  {childrenLinks &&
                  childrenLinks.map(child => (
                    <li key={child.name}>
                      <NavLink
                        to={child.link}
                        exact
                        onClick={() =>
                          this.setState({
                            isOpen: true,
                          })
                        }
                        activeClassName={s.headerLinkActive}
                      >
                        {child.name}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </Collapse>
            </li>
          );
        }}
      />
    );
  }
}

export default LinksGroup;
